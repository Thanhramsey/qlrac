import {
  Button,
  Col,
  Descriptions,
  Modal,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd'
import { HistoryOutlined, SendOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { apiClient } from '../api/axios.instance'
import type { HouseholdInvoiceHistoryResponse, InvoiceItem } from '../types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function paymentStatusTag(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    PAID: { color: 'success', label: 'Đã thu' },
    PUBLISHED: { color: 'processing', label: 'Đã xuất HĐ' },
    UNPAID: { color: 'warning', label: 'Chưa thu' },
    OVERDUE: { color: 'error', label: 'Quá hạn' },
  }
  const cfg = map[status] ?? { color: 'default', label: status }
  return <Tag color={cfg.color}>{cfg.label}</Tag>
}

type PublishResult = {
  invoiceId: number
  success: boolean
  message: string
}

export function HouseholdHistoryModal({
  householdId,
  onClose,
}: {
  householdId: number | null
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<HouseholdInvoiceHistoryResponse | null>(null)
  const [publishingIds, setPublishingIds] = useState<Set<number>>(new Set())
  const [publishAllLoading, setPublishAllLoading] = useState(false)

  const loadHistory = () => {
    if (!householdId) {
      setData(null)
      return
    }
    setLoading(true)
    apiClient
      .get<HouseholdInvoiceHistoryResponse>(`/invoices/household/${householdId}/history`)
      .then((res) => setData(res.data))
      .catch((err) => message.error(err instanceof Error ? err.message : 'Không tải được lịch sử'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadHistory()
  }, [householdId])

  const invoicesList = useMemo(() => data?.invoices ?? [], [data])

  const totalDebt = useMemo(() => {
    if (!invoicesList.length) return 0
    return invoicesList
      .filter((inv) => inv && (inv.trangThaiThanhToan === 'UNPAID' || inv.trangThaiThanhToan === 'OVERDUE'))
      .reduce((sum, inv) => sum + Number(inv.tongTien || 0) + Number(inv.thue || 0), 0)
  }, [invoicesList])

  const recentTimeline = useMemo(() => {
    if (!invoicesList.length) return []
    return [...invoicesList]
      .filter(Boolean)
      .sort((a, b) => (b.kyHoaDon || '').localeCompare(a.kyHoaDon || ''))
      .slice(0, 6)
  }, [invoicesList])

  // Hóa đơn chưa xuất HĐ điện tử (PAID, UNPAID, OVERDUE) — đều có thể xuất
  const publishableInvoices = useMemo(
    () => invoicesList.filter((inv) => inv && inv.trangThaiThanhToan !== 'PUBLISHED'),
    [invoicesList],
  )

  const handlePublishSingle = async (invoiceId: number) => {
    setPublishingIds((prev) => new Set(prev).add(invoiceId))
    try {
      const res = await apiClient.post<{
        message?: string
        successCount?: number
        failCount?: number
        results?: PublishResult[]
      }>('/invoices/publish', { invoiceIds: [invoiceId] })

      const resData = res.data
      if ((resData.failCount ?? 0) > 0) {
        const failMsg = resData.results?.find((r) => !r.success)?.message
        message.warning(`Xuất hóa đơn thất bại: ${failMsg ?? 'Lỗi không xác định'}`)
      } else {
        message.success(resData.message ?? 'Xuất hóa đơn điện tử thành công')
      }
      loadHistory()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể xuất hóa đơn điện tử')
    } finally {
      setPublishingIds((prev) => {
        const next = new Set(prev)
        next.delete(invoiceId)
        return next
      })
    }
  }

  const handlePublishAll = async () => {
    if (publishableInvoices.length === 0) {
      message.warning('Tất cả hóa đơn đã được xuất HĐ điện tử')
      return
    }
    setPublishAllLoading(true)
    try {
      const ids = publishableInvoices.map((inv) => inv.id)
      const res = await apiClient.post<{
        message?: string
        successCount?: number
        failCount?: number
        results?: PublishResult[]
      }>('/invoices/publish', { invoiceIds: ids })

      const resData = res.data
      if ((resData.failCount ?? 0) > 0) {
        const failed = (resData.results ?? []).filter((r) => !r.success)
        const details = failed.slice(0, 3).map((r) => `#${r.invoiceId}: ${r.message}`).join('\n')
        message.warning(
          `${resData.message ?? 'Hoàn tất với một số lỗi'}${details ? `\n${details}` : ''}`,
        )
      } else {
        message.success(
          resData.message ??
            `Đã xuất thành công ${resData.successCount ?? ids.length} hóa đơn điện tử`,
        )
      }
      loadHistory()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể xuất hóa đơn điện tử')
    } finally {
      setPublishAllLoading(false)
    }
  }

  const historyColumns = [
    { title: 'Kỳ HĐ', dataIndex: 'kyHoaDon', width: 100 },
    {
      title: 'Số tiền',
      width: 130,
      render: (_: unknown, inv: InvoiceItem) =>
        inv ? formatCurrency(Number(inv.tongTien || 0) + Number(inv.thue || 0)) : '-',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trangThaiThanhToan',
      width: 130,
      render: (val: string) => paymentStatusTag(val),
    },
    {
      title: 'Ngày thanh toán',
      dataIndex: 'paymentDate',
      width: 130,
      render: (val: string | null) => (val ? dayjs(val).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Người thu',
      dataIndex: 'collectedByName',
      width: 130,
      render: (val: string | null) => val ?? '-',
    },
    {
      title: 'Ghi chú',
      dataIndex: 'paymentNote',
      ellipsis: true,
      render: (val: string | null) => val ?? '-',
    },
    {
      title: 'Xuất HĐ điện tử',
      key: 'publish',
      width: 155,
      fixed: 'right' as const,
      render: (_: unknown, inv: InvoiceItem) => {
        if (!inv) return null
        if (inv.trangThaiThanhToan === 'PUBLISHED') {
          return (
            <Tag color="processing" icon={<CheckCircleOutlined />}>
              Đã xuất HĐ
            </Tag>
          )
        }

        const isUnpaid = inv.trangThaiThanhToan === 'UNPAID' || inv.trangThaiThanhToan === 'OVERDUE'

        return (
          <Popconfirm
            title="Xuất hóa đơn điện tử"
            description={
              isUnpaid
                ? `Hóa đơn kỳ ${inv.kyHoaDon} đang chưa thu. Phát hành VNPT sẽ tự động thu tiền và xuất HĐ. Bạn chắc chắn chứ?`
                : `Xác nhận xuất HĐ điện tử kỳ ${inv.kyHoaDon}?`
            }
            okText="Xuất HĐ"
            cancelText="Hủy"
            onConfirm={() => void handlePublishSingle(inv.id)}
          >
            <Button
              size="small"
              type="primary"
              icon={<SendOutlined />}
              loading={publishingIds.has(inv.id)}
              style={{ background: '#0a5bd8', borderColor: '#0a5bd8' }}
            >
              Xuất HĐ
            </Button>
          </Popconfirm>
        )
      },
    },
  ]

  return (
    <Modal
      open={!!householdId}
      onCancel={onClose}
      footer={null}
      width={1000}
      title={
        <Space>
          <HistoryOutlined />
          <span>Lịch sử thanh toán – {data?.household?.tenChuHo ?? '...'}</span>
        </Space>
      }
      destroyOnClose
    >
      {/* KPI Summary */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Statistic title="Tổng hóa đơn" value={data?.summary?.total ?? 0} loading={loading} />
        </Col>
        <Col span={6}>
          <Statistic
            title="Đã thanh toán"
            value={data?.summary?.paid ?? 0}
            loading={loading}
            valueStyle={{ color: '#52c41a' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Chưa thanh toán"
            value={data?.summary?.unpaid ?? 0}
            loading={loading}
            valueStyle={{ color: '#ff4d4f' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Tổng tiền nợ"
            value={totalDebt}
            loading={loading}
            valueStyle={{ color: '#faad14' }}
            formatter={(val) => formatCurrency(Number(val))}
          />
        </Col>
      </Row>

      {/* Household info */}
      {data?.household && (
        <Descriptions size="small" bordered column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Mã KH">{data.household.maHoDan || '-'}</Descriptions.Item>
          <Descriptions.Item label="Họ tên">{data.household.tenChuHo || '-'}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ" span={2}>{data.household.diaChi || '-'}</Descriptions.Item>
        </Descriptions>
      )}

      {/* Recent Timeline */}
      {recentTimeline.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            6 kỳ gần nhất
          </Typography.Text>
          <Timeline
            items={recentTimeline.map((inv) => ({
              color:
                inv.trangThaiThanhToan === 'PAID' || inv.trangThaiThanhToan === 'PUBLISHED'
                  ? 'green'
                  : inv.trangThaiThanhToan === 'OVERDUE'
                    ? 'red'
                    : 'orange',
              children: (
                <Space>
                  <Typography.Text strong>{inv.kyHoaDon}</Typography.Text>
                  {paymentStatusTag(inv.trangThaiThanhToan)}
                  <Typography.Text>
                    {formatCurrency(Number(inv.tongTien || 0) + Number(inv.thue || 0))}
                  </Typography.Text>
                  {inv.paymentDate && (
                    <Typography.Text type="secondary">
                      – {dayjs(inv.paymentDate).format('DD/MM/YYYY')}
                    </Typography.Text>
                  )}
                </Space>
              ),
            }))}
          />
        </div>
      )}

      {/* Toolbar + Table */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Danh sách toàn bộ hóa đơn
        </Typography.Text>
        {publishableInvoices.length > 0 && (
          <Popconfirm
            title={`Xuất ${publishableInvoices.length} hóa đơn điện tử`}
            description={`Xác nhận xuất tất cả ${publishableInvoices.length} hóa đơn chưa phát hành của hộ này?`}
            okText="Xuất tất cả"
            cancelText="Hủy"
            onConfirm={() => void handlePublishAll()}
          >
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={publishAllLoading}
              style={{ background: '#0a5bd8', borderColor: '#0a5bd8' }}
            >
              Xuất tất cả ({publishableInvoices.length}) HĐ điện tử
            </Button>
          </Popconfirm>
        )}
      </div>

      <Table<InvoiceItem>
        rowKey="id"
        loading={loading}
        dataSource={invoicesList}
        columns={historyColumns}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        size="small"
        rowClassName={(inv) =>
          inv?.trangThaiThanhToan === 'PAID'
            ? 'household-history-paid-row'
            : ''
        }
      />
    </Modal>
  )
}
