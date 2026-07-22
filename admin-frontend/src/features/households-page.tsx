import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  Upload,
  message,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { apiClient } from '../api/axios.instance'
import type {
  HouseholdItem,
  PagedResponse,
  RouteItem,
  ServiceCatalogItem,
} from '../types'
import { HouseholdHistoryModal } from '../components/HouseholdHistoryModal'

type HouseholdFormValues = {
  maHoDan: string
  tenChuHo: string
  diaChi: string
  soDienThoai: string
  soGiayTo: string
  ngayCapGiayTo?: dayjs.Dayjs
  maSoThue?: string
  serviceCatalogId?: number
  tuyenThuRacId: number
  isActive: boolean
}

type HouseholdSearchValues = {
  serviceCatalogId?: number
  tuyenThuRacId?: number
  tenChuHo?: string
  diaChi?: string
}


export function HouseholdsPage() {
  const [listData, setListData] = useState<HouseholdItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingItem, setEditingItem] = useState<HouseholdItem | null>(null)
  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [services, setServices] = useState<ServiceCatalogItem[]>([])
  const [historyHouseholdId, setHistoryHouseholdId] = useState<number | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  })
  const [searchValues, setSearchValues] = useState<HouseholdSearchValues>({})
  const [includeInactive, setIncludeInactive] = useState(false)

  const [form] = Form.useForm<HouseholdFormValues>()
  const [searchForm] = Form.useForm<HouseholdSearchValues>()

  const routeOptions = useMemo(
    () =>
      routes.map((item) => ({
        value: item.id,
        label: `${item.tenTuyen} (${item.maTuyen})`,
      })),
    [routes],
  )

  const serviceOptions = useMemo(
    () =>
      services
        .filter((item) => item.isActive)
        .map((item) => ({
          value: item.id,
          label: `${item.tenDichVu} (${item.maDichVu})`,
        })),
    [services],
  )

  const fetchHouseholds = async (
    page = pagination.page,
    limit = pagination.limit,
    filters: HouseholdSearchValues = searchValues,
  ) => {
    setLoading(true)
    try {
      const response = await apiClient.get<PagedResponse<HouseholdItem>>('/households', {
        params: {
          page,
          limit,
          serviceCatalogId: filters.serviceCatalogId,
          tuyenThuRacId: filters.tuyenThuRacId,
          tenChuHo: filters.tenChuHo?.trim() || undefined,
          diaChi: filters.diaChi?.trim() || undefined,
          includeInactive,
        },
      })
      setListData(response.data.data)
      setPagination({
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        total: response.data.pagination.total,
      })
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách hộ dân')
    } finally {
      setLoading(false)
    }
  }

  const fetchRoutes = async () => {
    const response = await apiClient.get<PagedResponse<RouteItem>>('/routes', {
      params: { page: 1, limit: 1000 },
    })
    setRoutes(response.data.data)
  }

  const fetchServices = async () => {
    const response = await apiClient.get<PagedResponse<ServiceCatalogItem>>('/service-catalogs', {
      params: { page: 1, limit: 1000 },
    })
    setServices(response.data.data)
  }

  useEffect(() => {
    void fetchHouseholds(1, 10, {})
    void fetchRoutes()
    void fetchServices()
  }, [includeInactive])

  const onSearch = async () => {
    const values = searchForm.getFieldsValue()
    const normalized: HouseholdSearchValues = {
      serviceCatalogId: values.serviceCatalogId,
      tuyenThuRacId: values.tuyenThuRacId,
      tenChuHo: values.tenChuHo?.trim() || undefined,
      diaChi: values.diaChi?.trim() || undefined,
    }

    setSearchValues(normalized)
    await fetchHouseholds(1, pagination.limit, normalized)
  }

  const onResetSearch = async () => {
    searchForm.resetFields()
    const emptyFilters: HouseholdSearchValues = {}
    setSearchValues(emptyFilters)
    await fetchHouseholds(1, pagination.limit, emptyFilters)
  }

  const openCreateModal = () => {
    setEditingItem(null)
    form.resetFields()
    form.setFieldsValue({
      isActive: true,
      tuyenThuRacId: routeOptions[0]?.value,
    })
    setModalOpen(true)
  }

  const openEditModal = (item: HouseholdItem) => {
    setEditingItem(item)
    form.setFieldsValue({
      maHoDan: item.maHoDan,
      tenChuHo: item.tenChuHo,
      diaChi: item.diaChi,
      soDienThoai: item.soDienThoai,
      soGiayTo: item.soGiayTo,
      ngayCapGiayTo: item.ngayCapGiayTo ? dayjs(item.ngayCapGiayTo) : undefined,
      maSoThue: item.maSoThue ?? undefined,
      serviceCatalogId: item.serviceCatalogId ?? undefined,
      tuyenThuRacId: item.tuyenThuRacId,
      isActive: item.isActive,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingItem(null)
    form.resetFields()
  }

  const onSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      const payload = {
        ...values,
        ngayCapGiayTo: values.ngayCapGiayTo
          ? values.ngayCapGiayTo.format('YYYY-MM-DD')
          : undefined,
        serviceCatalogId: values.serviceCatalogId ?? null,
      }

      if (editingItem) {
        await apiClient.patch(`/households/${editingItem.id}`, payload)
        message.success('Cập nhật hộ dân thành công')
      } else {
        await apiClient.post('/households', payload)
        message.success('Thêm hộ dân thành công')
      }

      closeModal()
      void fetchHouseholds(pagination.page, pagination.limit)
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) {
        return
      }
      message.error(error instanceof Error ? error.message : 'Không lưu được hộ dân')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: number) => {
    try {
      await apiClient.delete(`/households/${id}`)
      message.success('Xóa hộ dân thành công')
      void fetchHouseholds(pagination.page, pagination.limit)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Xóa hộ dân thất bại')
    }
  }

  const onRestore = async (id: number) => {
    try {
      await apiClient.patch(`/households/${id}/restore`)
      message.success('Khôi phục hộ dân thành công')
      void fetchHouseholds(pagination.page, pagination.limit, searchValues)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Khôi phục hộ dân thất bại')
    }
  }

  const downloadHouseholdTemplate = () => {
    const importRows = [
      {
        maHoDan: 'HD-0100',
        tenChuHo: 'Nguyen Van A',
        diaChi: 'To 1, An Khe, Da Nang',
        soDienThoai: '0911222333',
        soGiayTo: '201000000100',
        ngayCapGiayTo: '2024-01-15',
        maSoThue: '0403000100',
        serviceCatalogId: '',
        tuyenThuRacId: '',
        isActive: true,
      },
    ]

    const lookupRows = [
      ...services.map((item) => ({
        loaiDanhMuc: 'DICH_VU',
        id: item.id,
        ma: item.maDichVu,
        ten: item.tenDichVu,
        ghiChu: `Gia: ${item.giaDichVu} - Thue: ${item.thuePhanTram}%`,
      })),
      ...routes.map((item) => ({
        loaiDanhMuc: 'TUYEN_DUONG',
        id: item.id,
        ma: item.maTuyen,
        ten: item.tenTuyen,
        ghiChu: item.khuVuc,
      })),
    ]

    const workbook = XLSX.utils.book_new()
    const importSheet = XLSX.utils.json_to_sheet(importRows)
    const lookupSheet = XLSX.utils.json_to_sheet(lookupRows)

    XLSX.utils.book_append_sheet(workbook, importSheet, 'Mau_Import_Ho_Dan')
    XLSX.utils.book_append_sheet(workbook, lookupSheet, 'Tra_Cuu_Dich_Vu_Tuyen')

    XLSX.writeFile(workbook, 'template-import-households.xlsx')
  }

  return (
    <Card className="page-card" variant="borderless">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Quản lý hộ dân</h3>
          <Space>
            <Space>
              <span>Hiện đã xóa</span>
              <Switch
                checked={includeInactive}
                onChange={(value) => {
                  setIncludeInactive(value)
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
              />
            </Space>
            <Button
              className="excel-green-btn"
              icon={<UploadOutlined />}
              onClick={downloadHouseholdTemplate}
            >
              Tải file mẫu
            </Button>
            <Upload
              accept=".xlsx,.xls,.csv"
              showUploadList={false}
              beforeUpload={(file) => {
                const formData = new FormData()
                formData.append('file', file)

                void (async () => {
                  try {
                    const response = await apiClient.post('/households/import', formData, {
                      headers: {
                        'Content-Type': 'multipart/form-data',
                      },
                    })
                    message.success(response.data?.message ?? 'Import hộ dân thành công')
                    void fetchHouseholds(1, pagination.limit)
                  } catch (error) {
                    message.error(error instanceof Error ? error.message : 'Import hộ dân thất bại')
                  }
                })()

                return false
              }}
            >
              <Button className="excel-green-btn" icon={<UploadOutlined />}>
                Import Excel
              </Button>
            </Upload>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Thêm hộ dân
            </Button>
          </Space>
        </Space>

        <Card size="small" style={{ background: '#f8fbfc' }}>
          <Form form={searchForm} layout="inline">
            <Space wrap size={8} style={{ width: '100%' }}>
              <Form.Item name="tenChuHo" style={{ marginBottom: 0 }}>
                <Input style={{ width: 200 }} placeholder="Tên chủ hộ" />
              </Form.Item>
              <Form.Item name="diaChi" style={{ marginBottom: 0 }}>
                <Input style={{ width: 240 }} placeholder="Địa chỉ" />
              </Form.Item>
              <Form.Item name="serviceCatalogId" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  style={{ width: 220 }}
                  options={serviceOptions}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Loại dịch vụ"
                />
              </Form.Item>
              <Form.Item name="tuyenThuRacId" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  style={{ width: 220 }}
                  options={routeOptions}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tuyến đường"
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button type="primary" onClick={() => void onSearch()}>
                    Tìm kiếm
                  </Button>
                  <Button onClick={() => void onResetSearch()}>Đặt lại</Button>
                </Space>
              </Form.Item>
            </Space>
          </Form>
        </Card>

        <Table<HouseholdItem>
          rowKey="id"
          loading={loading}
          dataSource={listData}
          scroll={{ x: 1600 }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showSizeChanger: true,
            onChange: (page, pageSize) => void fetchHouseholds(page, pageSize, searchValues),
          }}
          columns={[
            { title: 'Mã KH', dataIndex: 'maHoDan', width: 120 },
            { title: 'Họ tên', dataIndex: 'tenChuHo', width: 180 },
            { title: 'Địa chỉ', dataIndex: 'diaChi', width: 220 },
            { title: 'Số điện thoại', dataIndex: 'soDienThoai', width: 130 },
            { title: 'Số giấy tờ', dataIndex: 'soGiayTo', width: 140 },
            {
              title: 'Ngày cấp giấy tờ',
              dataIndex: 'ngayCapGiayTo',
              width: 140,
              render: (value: string | null | undefined) =>
                value ? dayjs(value).format('DD/MM/YYYY') : '-',
            },
            { title: 'Mã số thuế', dataIndex: 'maSoThue', width: 140, render: (value: string | null | undefined) => value || '-' },
            {
              title: 'Loại dịch vụ',
              dataIndex: 'serviceCatalog',
              width: 220,
              render: (service: HouseholdItem['serviceCatalog']) =>
                service ? `${service.tenDichVu} (${service.maDichVu})` : '-',
            },
            {
              title: 'Tuyến đường',
              dataIndex: 'tuyenThuRac',
              width: 180,
              render: (route: HouseholdItem['tuyenThuRac']) =>
                route ? `${route.tenTuyen} (${route.maTuyen})` : '-',
            },
            {
              title: 'Ngày tạo',
              dataIndex: 'createdAt',
              width: 140,
              render: (value: string) => dayjs(value).format('DD/MM/YYYY'),
            },
            {
              title: 'Trạng thái',
              dataIndex: 'isActive',
              width: 120,
              render: (value: boolean) =>
                value ? <Tag color="green">Hoạt động</Tag> : <Tag>Khóa</Tag>,
            },
            {
              title: 'Thao tác',
              key: 'actions',
              width: 160,
              fixed: 'right',
              render: (_, record) => (
                <Space>
                  <Tooltip title="Lịch sử thanh toán">
                    <Button
                      size="small"
                      icon={<HistoryOutlined />}
                      onClick={() => setHistoryHouseholdId(record.id)}
                    />
                  </Tooltip>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEditModal(record)}
                    disabled={!record.isActive}
                  />
                  {record.isActive ? (
                    <Popconfirm
                      title="Xóa hộ dân"
                      description="Bạn chắc chắn muốn xóa hộ dân này?"
                      okText="Xóa"
                      cancelText="Hủy"
                      onConfirm={() => void onDelete(record.id)}
                    >
                      <Button danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ) : (
                    <Button size="small" onClick={() => void onRestore(record.id)}>
                      Khôi phục
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Space>

      <Modal
        title={editingItem ? 'Cập nhật hộ dân' : 'Thêm hộ dân'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void onSave()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={saving}
        width={900}
      >
        <Form<HouseholdFormValues> form={form} layout="vertical" initialValues={{ isActive: true }}>
          <div className="form-grid">
            <Form.Item
              label="Mã KH"
              name="maHoDan"
              rules={[{ required: true, message: 'Bắt buộc nhập mã KH' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Họ tên"
              name="tenChuHo"
              rules={[{ required: true, message: 'Bắt buộc nhập họ tên' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Số điện thoại"
              name="soDienThoai"
              rules={[{ required: true, message: 'Bắt buộc nhập số điện thoại' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Số giấy tờ"
              name="soGiayTo"
              rules={[{ required: true, message: 'Bắt buộc nhập số giấy tờ' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="Ngày cấp giấy tờ" name="ngayCapGiayTo">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item label="Mã số thuế" name="maSoThue">
              <Input />
            </Form.Item>
            <Form.Item label="Loại dịch vụ" name="serviceCatalogId">
              <Select allowClear options={serviceOptions} showSearch optionFilterProp="label" />
            </Form.Item>
            <Form.Item
              label="Tuyến đường"
              name="tuyenThuRacId"
              rules={[{ required: true, message: 'Bắt buộc chọn tuyến đường' }]}
            >
              <Select options={routeOptions} showSearch optionFilterProp="label" />
            </Form.Item>
            <Form.Item
              className="full-col"
              label="Địa chỉ"
              name="diaChi"
              rules={[{ required: true, message: 'Bắt buộc nhập địa chỉ' }]}
            >
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item label="Trạng thái" name="isActive" valuePropName="checked" className="full-col">
              <Switch checkedChildren="Hoạt động" unCheckedChildren="Khóa" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <HouseholdHistoryModal
        householdId={historyHouseholdId}
        onClose={() => setHistoryHouseholdId(null)}
      />
    </Card>
  )
}
