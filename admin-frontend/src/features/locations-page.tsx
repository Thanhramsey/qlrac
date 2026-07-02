import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Upload,
  Typography,
  message,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { apiClient } from '../api/axios.instance'
import type {
  LocalityItem,
  PagedResponse,
  ProvinceItem,
  RouteItem,
  UserListItem,
  UserListResponse,
  WardItem,
} from '../types'

type ProvinceFormValues = {
  maTinh: string
  tenTinh: string
}

type WardFormValues = {
  provinceId: number
  maPhuongXa: string
  tenPhuongXa: string
}

type LocalityFormValues = {
  wardId: number
  maThonXomTo: string
  tenThonXomTo: string
}

type RouteFormValues = {
  maTuyen: string
  tenTuyen: string
  khuVuc: string
  localityId?: number
  staffId?: number
}

interface LocationsPageProps {
  visible: boolean
  currentUserRole?: string
}

export function LocationsPage({ visible, currentUserRole }: LocationsPageProps) {
  const [activeTab, setActiveTab] = useState('routes')
  const canManageGeo = currentUserRole === 'ADMIN' || currentUserRole === 'ADMIN_LEVEL_2'

  const [provinceForm] = Form.useForm<ProvinceFormValues>()
  const [wardForm] = Form.useForm<WardFormValues>()
  const [localityForm] = Form.useForm<LocalityFormValues>()
  const [routeForm] = Form.useForm<RouteFormValues>()

  const [provinces, setProvinces] = useState<ProvinceItem[]>([])
  const [provincesLoading, setProvincesLoading] = useState(false)
  const [provinceModalOpen, setProvinceModalOpen] = useState(false)
  const [provinceSaving, setProvinceSaving] = useState(false)
  const [editingProvince, setEditingProvince] = useState<ProvinceItem | null>(null)

  const [wards, setWards] = useState<WardItem[]>([])
  const [wardsLoading, setWardsLoading] = useState(false)
  const [wardModalOpen, setWardModalOpen] = useState(false)
  const [wardSaving, setWardSaving] = useState(false)
  const [editingWard, setEditingWard] = useState<WardItem | null>(null)

  const [localities, setLocalities] = useState<LocalityItem[]>([])
  const [localitiesLoading, setLocalitiesLoading] = useState(false)
  const [localityModalOpen, setLocalityModalOpen] = useState(false)
  const [localitySaving, setLocalitySaving] = useState(false)
  const [editingLocality, setEditingLocality] = useState<LocalityItem | null>(null)

  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [routesLoading, setRoutesLoading] = useState(false)
  const [routeModalOpen, setRouteModalOpen] = useState(false)
  const [routeSaving, setRouteSaving] = useState(false)
  const [editingRoute, setEditingRoute] = useState<RouteItem | null>(null)

  const [staffOptions, setStaffOptions] = useState<UserListItem[]>([])

  const provinceOptions = useMemo(
    () => provinces.map((item) => ({ value: item.id, label: `${item.tenTinh} (${item.maTinh})` })),
    [provinces],
  )

  const wardOptions = useMemo(
    () =>
      wards.map((item) => ({
        value: item.id,
        label: `${item.tenPhuongXa} (${item.maPhuongXa}) - ${item.province?.tenTinh ?? ''}`,
      })),
    [wards],
  )

  const localityOptions = useMemo(
    () =>
      localities.map((item) => ({
        value: item.id,
        label: `${item.tenThonXomTo} (${item.maThonXomTo}) - ${item.ward?.tenPhuongXa ?? ''}`,
      })),
    [localities],
  )

  const staffSelectOptions = useMemo(
    () =>
      staffOptions
        .filter((item) => item.isActive)
        .map((item) => ({
          value: item.id,
          label: `${item.hoVaTen} (${item.taiKhoan})`,
        })),
    [staffOptions],
  )

  const fetchProvinces = async () => {
    setProvincesLoading(true)
    try {
      const response = await apiClient.get<PagedResponse<ProvinceItem>>('/provinces', {
        params: { page: 1, limit: 200 },
      })
      setProvinces(response.data.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách tỉnh')
    } finally {
      setProvincesLoading(false)
    }
  }

  const fetchWards = async () => {
    setWardsLoading(true)
    try {
      const response = await apiClient.get<PagedResponse<WardItem>>('/wards', {
        params: { page: 1, limit: 500 },
      })
      setWards(response.data.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách phường/xã')
    } finally {
      setWardsLoading(false)
    }
  }

  const fetchLocalities = async () => {
    setLocalitiesLoading(true)
    try {
      const response = await apiClient.get<PagedResponse<LocalityItem>>('/localities', {
        params: { page: 1, limit: 1000 },
      })
      setLocalities(response.data.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách thôn/xóm/tổ')
    } finally {
      setLocalitiesLoading(false)
    }
  }

  const fetchRoutes = async () => {
    setRoutesLoading(true)
    try {
      const response = await apiClient.get<PagedResponse<RouteItem>>('/routes', {
        params: { page: 1, limit: 1000 },
      })
      setRoutes(response.data.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách tuyến đường')
    } finally {
      setRoutesLoading(false)
    }
  }

  const fetchStaff = async () => {
    try {
      const response = await apiClient.get<UserListResponse>('/users', {
        params: { page: 1, limit: 300 },
      })
      setStaffOptions(response.data.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách nhân viên')
    }
  }

  const fetchAll = async () => {
    if (canManageGeo) {
      await Promise.all([
        fetchProvinces(),
        fetchWards(),
        fetchLocalities(),
        fetchRoutes(),
        fetchStaff(),
      ])
      return
    }

    await fetchRoutes()
  }

  useEffect(() => {
    if (visible) {
      void fetchAll()
    }
  }, [visible, canManageGeo])

  useEffect(() => {
    if (!canManageGeo && activeTab !== 'routes') {
      setActiveTab('routes')
    }
  }, [canManageGeo, activeTab])

  const closeProvinceModal = () => {
    setProvinceModalOpen(false)
    setEditingProvince(null)
    provinceForm.resetFields()
  }

  const closeWardModal = () => {
    setWardModalOpen(false)
    setEditingWard(null)
    wardForm.resetFields()
  }

  const closeLocalityModal = () => {
    setLocalityModalOpen(false)
    setEditingLocality(null)
    localityForm.resetFields()
  }

  const closeRouteModal = () => {
    setRouteModalOpen(false)
    setEditingRoute(null)
    routeForm.resetFields()
  }

  const saveProvince = async () => {
    try {
      const values = await provinceForm.validateFields()
      setProvinceSaving(true)
      if (editingProvince) {
        await apiClient.patch(`/provinces/${editingProvince.id}`, values)
        message.success('Cập nhật tỉnh thành công')
      } else {
        await apiClient.post('/provinces', values)
        message.success('Thêm tỉnh thành công')
      }
      closeProvinceModal()
      void fetchProvinces()
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setProvinceSaving(false)
    }
  }

  const saveWard = async () => {
    try {
      const values = await wardForm.validateFields()
      setWardSaving(true)
      if (editingWard) {
        await apiClient.patch(`/wards/${editingWard.id}`, values)
        message.success('Cập nhật phường/xã thành công')
      } else {
        await apiClient.post('/wards', values)
        message.success('Thêm phường/xã thành công')
      }
      closeWardModal()
      await fetchWards()
      await fetchLocalities()
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setWardSaving(false)
    }
  }

  const saveLocality = async () => {
    try {
      const values = await localityForm.validateFields()
      setLocalitySaving(true)
      if (editingLocality) {
        await apiClient.patch(`/localities/${editingLocality.id}`, values)
        message.success('Cập nhật thôn/xóm/tổ thành công')
      } else {
        await apiClient.post('/localities', values)
        message.success('Thêm thôn/xóm/tổ thành công')
      }
      closeLocalityModal()
      await fetchLocalities()
      await fetchRoutes()
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setLocalitySaving(false)
    }
  }

  const saveRoute = async () => {
    try {
      const values = await routeForm.validateFields()
      setRouteSaving(true)
      const payload = {
        ...values,
        localityId: values.localityId ?? null,
        staffId: values.staffId ?? null,
      }

      if (editingRoute) {
        await apiClient.patch(`/routes/${editingRoute.id}`, payload)
        message.success('Cập nhật tuyến đường thành công')
      } else {
        await apiClient.post('/routes', payload)
        message.success('Thêm tuyến đường thành công')
      }

      closeRouteModal()
      await fetchRoutes()
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setRouteSaving(false)
    }
  }

  const deleteItem = async (endpoint: string, id: number, successMessage: string, reload: () => Promise<void>) => {
    try {
      await apiClient.delete(`${endpoint}/${id}`)
      message.success(successMessage)
      await reload()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Thao tác thất bại')
    }
  }

  const downloadRouteTemplate = () => {
    const importRows = [
      {
        maTuyen: 'MT001',
        tenTuyen: 'Tuyến số 1',
        khuVuc: 'Khu vực A',
        localityId: 1,
        staffId: 1,
      },
      {
        maTuyen: 'MT002',
        tenTuyen: 'Tuyến số 2',
        khuVuc: 'Khu vực B',
        localityId: '',
        staffId: '',
      },
    ]

    const referenceRows = localities.map((locality) => ({
      localityId: locality.id,
      maThonXomTo: locality.maThonXomTo,
      tenThonXomTo: locality.tenThonXomTo,
      wardId: locality.ward?.id ?? '',
      maPhuongXa: locality.ward?.maPhuongXa ?? '',
      tenPhuongXa: locality.ward?.tenPhuongXa ?? '',
      provinceId: locality.ward?.province?.id ?? '',
      maTinh: locality.ward?.province?.maTinh ?? '',
      tenTinh: locality.ward?.province?.tenTinh ?? '',
    }))

    const workbook = XLSX.utils.book_new()
    const importSheet = XLSX.utils.json_to_sheet(importRows)
    const referenceSheet = XLSX.utils.json_to_sheet(referenceRows)

    XLSX.utils.book_append_sheet(workbook, importSheet, 'Mau_Import_Tuyen')
    XLSX.utils.book_append_sheet(workbook, referenceSheet, 'Tra_Cuu_Dia_Danh')

    XLSX.writeFile(workbook, 'template-import-routes.xlsx')
  }

  return (
    <Card className="page-card" variant="borderless">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Quản lý Địa danh và Tuyến đường
        </Typography.Title>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'routes',
              label: 'Tuyến đường',
              children: (
                <>
                  <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <Button
                      className="excel-green-btn"
                      icon={<UploadOutlined />}
                      onClick={downloadRouteTemplate}
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
                            const response = await apiClient.post('/routes/import', formData, {
                              headers: {
                                'Content-Type': 'multipart/form-data',
                              },
                            })
                            message.success(response.data?.message ?? 'Import tuyến đường thành công')
                            await fetchRoutes()
                          } catch (error) {
                            message.error(
                              error instanceof Error ? error.message : 'Import tuyến đường thất bại',
                            )
                          }
                        })()

                        return false
                      }}
                    >
                      <Button className="excel-green-btn" icon={<UploadOutlined />}>
                        Import Excel
                      </Button>
                    </Upload>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingRoute(null)
                        routeForm.resetFields()
                        setRouteModalOpen(true)
                      }}
                    >
                      Thêm tuyến đường
                    </Button>
                  </Space>
                  <Table<RouteItem>
                    rowKey="id"
                    loading={routesLoading}
                    dataSource={routes}
                    pagination={false}
                    columns={[
                      { title: 'Mã tuyến', dataIndex: 'maTuyen', width: 140 },
                      { title: 'Tên tuyến', dataIndex: 'tenTuyen', width: 220 },
                      { title: 'Khu vực', dataIndex: 'khuVuc', width: 180 },
                      {
                        title: 'Thôn/Xóm/Tổ',
                        dataIndex: 'locality',
                        render: (locality: RouteItem['locality']) =>
                          locality
                            ? `${locality.tenThonXomTo} (${locality.ward?.tenPhuongXa ?? '-'})`
                            : '-',
                      },
                      {
                        title: 'Nhân viên phụ trách',
                        dataIndex: 'staff',
                        render: (staff: RouteItem['staff']) =>
                          staff ? `${staff.hoVaTen} (${staff.taiKhoan})` : '-',
                      },
                      {
                        title: 'Thao tác',
                        width: 130,
                        render: (_, record) => (
                          <Space>
                            <Button
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => {
                                setEditingRoute(record)
                                routeForm.setFieldsValue({
                                  maTuyen: record.maTuyen,
                                  tenTuyen: record.tenTuyen,
                                  khuVuc: record.khuVuc,
                                  localityId: record.localityId ?? undefined,
                                  staffId: record.staffId ?? undefined,
                                })
                                setRouteModalOpen(true)
                              }}
                            />
                            <Popconfirm
                              title="Xóa tuyến đường"
                              description="Bạn chắc chắn muốn xóa tuyến đường này?"
                              okText="Xóa"
                              cancelText="Hủy"
                              onConfirm={() =>
                                void deleteItem('/routes', record.id, 'Xóa tuyến đường thành công', fetchRoutes)
                              }
                            >
                              <Button danger size="small" icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </>
              ),
            },
            ...(canManageGeo
              ? [
                  {
                    key: 'localities',
                    label: 'Thôn/Xóm/Tổ',
                    children: (
                      <>
                        <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 12 }}>
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                              setEditingLocality(null)
                              localityForm.resetFields()
                              if (wards[0]) {
                                localityForm.setFieldsValue({ wardId: wards[0].id })
                              }
                              setLocalityModalOpen(true)
                            }}
                          >
                            Thêm thôn/xóm/tổ
                          </Button>
                        </Space>
                        <Table<LocalityItem>
                          rowKey="id"
                          loading={localitiesLoading}
                          dataSource={localities}
                          pagination={false}
                          columns={[
                            { title: 'Mã thôn/xóm/tổ', dataIndex: 'maThonXomTo', width: 180 },
                            { title: 'Tên thôn/xóm/tổ', dataIndex: 'tenThonXomTo' },
                            {
                              title: 'Thuộc phường/xã',
                              dataIndex: 'ward',
                              render: (ward: LocalityItem['ward']) =>
                                ward ? `${ward.tenPhuongXa} (${ward.maPhuongXa})` : '-',
                            },
                            {
                              title: 'Thao tác',
                              width: 130,
                              render: (_, record) => (
                                <Space>
                                  <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => {
                                      setEditingLocality(record)
                                      localityForm.setFieldsValue({
                                        wardId: record.wardId,
                                        maThonXomTo: record.maThonXomTo,
                                        tenThonXomTo: record.tenThonXomTo,
                                      })
                                      setLocalityModalOpen(true)
                                    }}
                                  />
                                  <Popconfirm
                                    title="Xóa thôn/xóm/tổ"
                                    description="Bạn chắc chắn muốn xóa thôn/xóm/tổ này?"
                                    okText="Xóa"
                                    cancelText="Hủy"
                                    onConfirm={() =>
                                      void deleteItem(
                                        '/localities',
                                        record.id,
                                        'Xóa thôn/xóm/tổ thành công',
                                        fetchLocalities,
                                      )
                                    }
                                  >
                                    <Button danger size="small" icon={<DeleteOutlined />} />
                                  </Popconfirm>
                                </Space>
                              ),
                            },
                          ]}
                        />
                      </>
                    ),
                  },
                  {
                    key: 'wards',
                    label: 'Phường/Xã',
                    children: (
                      <>
                        <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 12 }}>
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                              setEditingWard(null)
                              wardForm.resetFields()
                              if (provinces[0]) {
                                wardForm.setFieldsValue({ provinceId: provinces[0].id })
                              }
                              setWardModalOpen(true)
                            }}
                          >
                            Thêm phường/xã
                          </Button>
                        </Space>
                        <Table<WardItem>
                          rowKey="id"
                          loading={wardsLoading}
                          dataSource={wards}
                          pagination={false}
                          columns={[
                            { title: 'Mã phường/xã', dataIndex: 'maPhuongXa', width: 160 },
                            { title: 'Tên phường/xã', dataIndex: 'tenPhuongXa' },
                            {
                              title: 'Thuộc tỉnh',
                              dataIndex: 'province',
                              render: (province: WardItem['province']) =>
                                province ? `${province.tenTinh} (${province.maTinh})` : '-',
                            },
                            {
                              title: 'Thao tác',
                              width: 130,
                              render: (_, record) => (
                                <Space>
                                  <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => {
                                      setEditingWard(record)
                                      wardForm.setFieldsValue({
                                        provinceId: record.provinceId,
                                        maPhuongXa: record.maPhuongXa,
                                        tenPhuongXa: record.tenPhuongXa,
                                      })
                                      setWardModalOpen(true)
                                    }}
                                  />
                                  <Popconfirm
                                    title="Xóa phường/xã"
                                    description="Bạn chắc chắn muốn xóa phường/xã này?"
                                    okText="Xóa"
                                    cancelText="Hủy"
                                    onConfirm={() =>
                                      void deleteItem('/wards', record.id, 'Xóa phường/xã thành công', fetchWards)
                                    }
                                  >
                                    <Button danger size="small" icon={<DeleteOutlined />} />
                                  </Popconfirm>
                                </Space>
                              ),
                            },
                          ]}
                        />
                      </>
                    ),
                  },
                  {
                    key: 'provinces',
                    label: 'Tỉnh',
                    children: (
                      <>
                        <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 12 }}>
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                              setEditingProvince(null)
                              provinceForm.resetFields()
                              setProvinceModalOpen(true)
                            }}
                          >
                            Thêm tỉnh
                          </Button>
                        </Space>
                        <Table<ProvinceItem>
                          rowKey="id"
                          loading={provincesLoading}
                          dataSource={provinces}
                          pagination={false}
                          columns={[
                            { title: 'Mã tỉnh', dataIndex: 'maTinh', width: 160 },
                            { title: 'Tên tỉnh', dataIndex: 'tenTinh' },
                            {
                              title: 'Thao tác',
                              width: 130,
                              render: (_, record) => (
                                <Space>
                                  <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => {
                                      setEditingProvince(record)
                                      provinceForm.setFieldsValue({
                                        maTinh: record.maTinh,
                                        tenTinh: record.tenTinh,
                                      })
                                      setProvinceModalOpen(true)
                                    }}
                                  />
                                  <Popconfirm
                                    title="Xóa tỉnh"
                                    description="Bạn chắc chắn muốn xóa tỉnh này?"
                                    okText="Xóa"
                                    cancelText="Hủy"
                                    onConfirm={() =>
                                      void deleteItem('/provinces', record.id, 'Xóa tỉnh thành công', fetchProvinces)
                                    }
                                  >
                                    <Button danger size="small" icon={<DeleteOutlined />} />
                                  </Popconfirm>
                                </Space>
                              ),
                            },
                          ]}
                        />
                      </>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Space>

      <Modal
        title={editingProvince ? 'Cập nhật tỉnh' : 'Thêm tỉnh'}
        open={provinceModalOpen}
        onCancel={closeProvinceModal}
        onOk={() => void saveProvince()}
        okText="Lưu"
        cancelText="Hủy"
        okButtonProps={{ loading: provinceSaving }}
      >
        <Form form={provinceForm} layout="vertical">
          <Form.Item label="Mã tỉnh" name="maTinh" rules={[{ required: true, message: 'Bắt buộc nhập mã tỉnh' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Tên tỉnh" name="tenTinh" rules={[{ required: true, message: 'Bắt buộc nhập tên tỉnh' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingWard ? 'Cập nhật phường/xã' : 'Thêm phường/xã'}
        open={wardModalOpen}
        onCancel={closeWardModal}
        onOk={() => void saveWard()}
        okText="Lưu"
        cancelText="Hủy"
        okButtonProps={{ loading: wardSaving }}
      >
        <Form form={wardForm} layout="vertical">
          <Form.Item label="Tỉnh" name="provinceId" rules={[{ required: true, message: 'Bắt buộc chọn tỉnh' }]}>
            <Select options={provinceOptions} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item
            label="Mã phường/xã"
            name="maPhuongXa"
            rules={[{ required: true, message: 'Bắt buộc nhập mã phường/xã' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Tên phường/xã"
            name="tenPhuongXa"
            rules={[{ required: true, message: 'Bắt buộc nhập tên phường/xã' }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingLocality ? 'Cập nhật thôn/xóm/tổ' : 'Thêm thôn/xóm/tổ'}
        open={localityModalOpen}
        onCancel={closeLocalityModal}
        onOk={() => void saveLocality()}
        okText="Lưu"
        cancelText="Hủy"
        okButtonProps={{ loading: localitySaving }}
      >
        <Form form={localityForm} layout="vertical">
          <Form.Item label="Phường/Xã" name="wardId" rules={[{ required: true, message: 'Bắt buộc chọn phường/xã' }]}>
            <Select options={wardOptions} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item
            label="Mã thôn/xóm/tổ"
            name="maThonXomTo"
            rules={[{ required: true, message: 'Bắt buộc nhập mã thôn/xóm/tổ' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Tên thôn/xóm/tổ"
            name="tenThonXomTo"
            rules={[{ required: true, message: 'Bắt buộc nhập tên thôn/xóm/tổ' }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingRoute ? 'Cập nhật tuyến đường' : 'Thêm tuyến đường'}
        open={routeModalOpen}
        onCancel={closeRouteModal}
        onOk={() => void saveRoute()}
        okText="Lưu"
        cancelText="Hủy"
        okButtonProps={{ loading: routeSaving }}
      >
        <Form form={routeForm} layout="vertical">
          <Form.Item label="Mã tuyến" name="maTuyen" rules={[{ required: true, message: 'Bắt buộc nhập mã tuyến' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Tên tuyến" name="tenTuyen" rules={[{ required: true, message: 'Bắt buộc nhập tên tuyến' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Khu vực" name="khuVuc" rules={[{ required: true, message: 'Bắt buộc nhập khu vực' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Thôn/Xóm/Tổ" name="localityId">
            <Select
              allowClear
              options={localityOptions}
              showSearch
              optionFilterProp="label"
              placeholder="Chọn thôn/xóm/tổ"
            />
          </Form.Item>
          <Form.Item label="Nhân viên phụ trách" name="staffId">
            <Select
              allowClear
              options={staffSelectOptions}
              showSearch
              optionFilterProp="label"
              placeholder="Chọn nhân viên phụ trách"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
