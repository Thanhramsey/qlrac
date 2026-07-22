import {
  Button,
  Card,
  Dropdown,
  Form,
  Image,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Upload,
  message,
} from 'antd'
import {
  CloudUploadOutlined,
  SyncOutlined,
  DownloadOutlined,
  DownOutlined,
  EditOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  HistoryOutlined,
  MoneyCollectOutlined,
  SearchOutlined,
  SendOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/axios.instance'
import { useDebounce } from '../hooks/use-debounce'
import type {
  BillingPeriodItem,
  HouseholdInvoiceHistoryResponse,
  InvoiceItem,
  InvoicePaymentStatus,
  PagedResponse,
  RouteItem,
  ServiceCatalogItem,
  SystemParameterItem,
} from '../types'

type InvoiceSearchValues = {
  kyHoaDon?: string
  tenChuHo?: string
  diaChi?: string
  tuyenThuRacId?: number
  serviceCatalogId?: number
  trangThaiThanhToan?: InvoicePaymentStatus
}

type UnitInfo = {
  tenDonVi: string
  maSoThue: string
  soDienThoai: string
  diaChi: string
  soTaiKhoanNganHang: string
}

const DEFAULT_UNIT_INFO: UnitInfo = {
  tenDonVi: 'BAN QUẢN LÝ PHƯỜNG AN KHÊ - GIA LAI',
  maSoThue: '',
  soDienThoai: '',
  diaChi: '',
  soTaiKhoanNganHang: '',
}

const PAYMENT_STATUS_OPTIONS: Array<{ label: string; value: InvoicePaymentStatus }> = [
  { label: 'Chưa thu', value: 'UNPAID' },
  { label: 'Đã thu (chưa xuất hóa đơn)', value: 'PAID' },
  { label: 'Đã xuất hóa đơn', value: 'PUBLISHED' },
  { label: 'Quá hạn', value: 'OVERDUE' },
]

const INVOICE_COLLECTION_UI_STYLE = `
  .invoice-toolbar .ant-btn {
    border-radius: 10px;
    font-weight: 600;
  }

  .invoice-toolbar .toolbar-generate-btn {
    border-color: #93c5fd;
    color: #1d4ed8;
  }

  .invoice-toolbar .toolbar-collect-btn {
    background: #0f766e;
    border-color: #0f766e;
    color: #ffffff;
  }

  .invoice-toolbar .toolbar-download-btn {
    border-color: #6366f1;
    color: #4338ca;
  }

  .invoice-toolbar .toolbar-publish-btn {
    background: #0a5bd8;
    border-color: #0a5bd8;
    color: #ffffff;
  }

  .invoice-toolbar .toolbar-sync-btn {
    border-color: #22c55e;
    color: #15803d;
  }

  .invoice-table-wrap .ant-table {
    border-radius: 14px;
    overflow: hidden;
  }

  .invoice-table-wrap .ant-table-thead > tr > th {
    background: linear-gradient(180deg, #f7fbff 0%, #eef6ff 100%);
    color: #174a7e;
    font-weight: 700;
  }

  .invoice-table-wrap .row-even > td {
    background: #ffffff;
  }

  .invoice-table-wrap .row-odd > td {
    background: #fcfeff;
  }

  .invoice-action-btn {
    border-radius: 9px;
    font-weight: 600;
  }

  .invoice-action-btn.collect {
    background: #0f766e;
    border-color: #0f766e;
    color: #fff;
  }

  .invoice-action-btn.history {
    border-color: #60a5fa;
    color: #1d4ed8;
  }

  .invoice-action-btn.status {
    border-color: #f59e0b;
    color: #b45309;
  }

  .invoice-action-btn.publish {
    background: #0a5bd8;
    border-color: #0a5bd8;
    color: #fff;
  }

  .invoice-action-btn.sync {
    border-color: #22c55e;
    color: #15803d;
  }

  .invoice-action-btn.download {
    border-color: #6366f1;
    color: #4338ca;
  }
`

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)
}

function toVietnameseMoneyText(value: number) {
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

  const readThreeDigits = (num: number, hasHigherGroup: boolean) => {
    const tram = Math.floor(num / 100)
    const chuc = Math.floor((num % 100) / 10)
    const donVi = num % 10
    const parts: string[] = []

    if (tram > 0 || hasHigherGroup) {
      parts.push(`${digits[tram]} trăm`)
    }

    if (chuc > 1) {
      parts.push(`${digits[chuc]} mươi`)
      if (donVi === 1) {
        parts.push('mốt')
      } else if (donVi === 5) {
        parts.push('lăm')
      } else if (donVi > 0) {
        parts.push(digits[donVi])
      }
    } else if (chuc === 1) {
      parts.push('mười')
      if (donVi === 5) {
        parts.push('lăm')
      } else if (donVi > 0) {
        parts.push(digits[donVi])
      }
    } else if (donVi > 0) {
      if (tram > 0 || hasHigherGroup) {
        parts.push('lẻ')
      }
      if (donVi === 5 && (tram > 0 || hasHigherGroup)) {
        parts.push('năm')
      } else {
        parts.push(digits[donVi])
      }
    }

    return parts.join(' ').trim()
  }

  const normalized = Math.round(Math.max(0, value))
  if (normalized === 0) {
    return 'Không đồng chẵn.'
  }

  const groups: number[] = []
  let remaining = normalized
  while (remaining > 0) {
    groups.unshift(remaining % 1000)
    remaining = Math.floor(remaining / 1000)
  }

  const units = ['', 'nghìn', 'triệu', 'tỷ']
  const textParts: string[] = []

  groups.forEach((groupValue, index) => {
    if (groupValue === 0) {
      return
    }

    const unitIndex = groups.length - 1 - index
    const unit = units[unitIndex] ?? ''
    const block = readThreeDigits(groupValue, index > 0)
    textParts.push(unit ? `${block} ${unit}` : block)
  })

  const merged = textParts.join(' ').replace(/\s+/g, ' ').trim()
  return `${merged.charAt(0).toUpperCase()}${merged.slice(1)} đồng chẵn.`
}

function getStatusTag(status: InvoicePaymentStatus) {
  if (status === 'PAID') {
    return <Tag color="success">Đã thu (chưa xuất HĐ)</Tag>
  }
  if (status === 'PUBLISHED') {
    return <Tag color="processing">Đã xuất hóa đơn</Tag>
  }
  if (status === 'OVERDUE') {
    return <Tag color="error">Quá hạn</Tag>
  }
  return <Tag color="warning">Chưa thu</Tag>
}

function getPublishStatusTag(status?: string | null) {
  if (status === 'SUCCESS') {
    return <Tag color="success">Đã phát hành</Tag>
  }

  if (status === 'FAILED') {
    return <Tag color="error">Lỗi phát hành</Tag>
  }

  return <Tag>Chưa phát hành</Tag>
}

const RECEIPT_STYLE = `
  .receipt-page {
    position: relative;
    width: 1000px;
    border: 1.5px solid #1b7a59;
    border-radius: 16px;
    padding: 22px 24px 18px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fbfa 100%);
    box-shadow: 0 8px 28px rgba(10, 83, 60, 0.16);
    overflow: hidden;
    color: #0d2d28;
    font-family: Arial, sans-serif;
  }
  .receipt-watermark {
    position: absolute;
    left: 50%;
    top: 47%;
    transform: translate(-50%, -50%);
    font-size: 220px;
    opacity: 0.06;
    color: #0d6d4c;
    line-height: 1;
    pointer-events: none;
  }
  .receipt-header { display: flex; justify-content: space-between; gap: 12px; position: relative; z-index: 2; }
  .header-left { display: flex; gap: 14px; align-items: flex-start; width: 58%; }
  .brand-logo {
    width: 78px;
    height: 78px;
    border: 3px solid #0b7a54;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    color: #0b7a54;
    flex: 0 0 auto;
  }
  .header-left h1 { margin: 0 0 8px; color: #0d704e; font-size: 42px; line-height: 1.08; letter-spacing: 0.4px; font-weight: 900; }
  .header-left p { margin: 2px 0; color: #203734; font-size: 24px; }
  .header-right { width: 42%; text-align: left; }
  .header-right h2 { margin: 0 0 12px; color: #0b6b4a; font-size: 40px; line-height: 1.12; letter-spacing: 0.3px; font-weight: 900; }
  .header-right p { margin: 4px 0; font-size: 26px; }
  .header-right strong { color: #d21313; }
  .divider { margin: 12px 0 12px; border-top: 2px dashed #cad8d3; position: relative; z-index: 2; }
  .info-grid { position: relative; z-index: 2; }
  .info-item { display: grid; grid-template-columns: 150px 1fr; align-items: baseline; margin: 6px 0; font-size: 24px; }
  .info-item span { color: #182a26; font-weight: 700; }
  .info-item strong { color: #0d704e; font-weight: 800; }
  .money-row { margin-top: 14px; display: flex; gap: 14px; align-items: stretch; position: relative; z-index: 2; }
  .money-box { flex: 1; border: 2px solid #d0e1db; border-radius: 10px; padding: 10px 12px; background: #f7faf9; }
  .money-line { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dotted #aabdb5; font-size: 27px; }
  .money-line.total { font-weight: 900; color: #0c6f4d; border-bottom: none; margin-top: 2px; font-size: 35px; }
  .money-text { margin-top: 4px; display: flex; gap: 8px; font-size: 22px; align-items: baseline; }
  .money-text span { font-weight: 700; }
  .status-box {
    width: 230px;
    border: 2px solid #1b7a59;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px;
    background: #f9fcfb;
    text-align: center;
  }
  .status-title { font-size: 22px; margin-bottom: 3px; }
  .status-value { font-size: 34px; font-weight: 900; color: #0d714f; margin-bottom: 4px; }
  .status-date { font-size: 22px; color: #203734; }
  .note { margin-top: 9px; font-size: 20px; font-style: italic; color: #223532; position: relative; z-index: 2; }
  .receipt-img-box {
    margin-top: 10px;
    border: 1px solid #c2d6cf;
    border-radius: 10px;
    padding: 8px;
    display: inline-block;
    background: #fff;
    position: relative;
    z-index: 2;
  }
  .receipt-img-box img {
    width: 170px;
    height: 170px;
    object-fit: cover;
    border-radius: 8px;
  }
  .receipt-footer {
    margin-top: 12px;
    background: linear-gradient(90deg, #0f7c57, #066245);
    color: #f4fff9;
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 22px;
    position: relative;
    z-index: 2;
  }
`

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function renderTextAsCanvas(title: string, content: string) {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.width = '1100px'
  container.style.background = '#ffffff'
  container.style.color = '#111827'
  container.style.padding = '24px'
  container.style.border = '1px solid #d1d5db'
  container.style.borderRadius = '8px'
  container.style.fontFamily = "'Times New Roman', serif"

  const heading = document.createElement('h2')
  heading.textContent = title
  heading.style.margin = '0 0 12px 0'

  const pre = document.createElement('pre')
  pre.textContent = content
  pre.style.whiteSpace = 'pre-wrap'
  pre.style.wordBreak = 'break-word'
  pre.style.margin = '0'
  pre.style.fontSize = '13px'
  pre.style.lineHeight = '1.45'

  container.appendChild(heading)
  container.appendChild(pre)
  document.body.appendChild(container)

  try {
    return await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    })
  } finally {
    document.body.removeChild(container)
  }
}

async function renderHtmlAsCanvas(htmlContent: string) {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '1200px'
  iframe.style.height = '1600px'
  iframe.style.border = '0'
  iframe.setAttribute('sandbox', 'allow-same-origin')

  document.body.appendChild(iframe)

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Render HTML hóa đơn bị timeout')), 7000)
      iframe.onload = () => {
        window.clearTimeout(timer)
        resolve()
      }
      iframe.srcdoc = htmlContent
    })

    const doc = iframe.contentDocument
    if (!doc?.documentElement) {
      throw new Error('Không thể đọc nội dung HTML hóa đơn')
    }

    const root = doc.documentElement as HTMLElement
    const width = Math.max(root.scrollWidth, 1100)
    const height = Math.max(root.scrollHeight, 1200)

    return await html2canvas(root, {
      scale: 1.4,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: width,
      windowHeight: height,
    })
  } finally {
    document.body.removeChild(iframe)
  }
}

function saveCanvasAsPdf(canvas: HTMLCanvasElement, filename: string) {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  const imgData = canvas.toDataURL('image/jpeg', 0.72)

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
    heightLeft -= pageHeight
  }

  pdf.save(filename)
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64.replace(/\s+/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Blob([bytes], { type: mimeType })
}

function buildReceiptMarkup(item: InvoiceItem, unitInfo: UnitInfo) {
  const total = Number(item.tongTien) + Number(item.thue)
  const taxPercent = Number(item.tongTien) > 0 ? Math.round((Number(item.thue) * 100) / Number(item.tongTien)) : 0
  const routeName = item.household?.tuyenThuRac?.tenTuyen ?? '---'
  const serviceName = item.household?.serviceCatalog?.tenDichVu ?? '---'
  const paymentDate = item.paymentDate ? new Date(item.paymentDate).toLocaleString('vi-VN') : '---'
  const issueDate = new Date(item.createdAt || Date.now()).toLocaleString('vi-VN')
  const receiptCode = `PT${String(item.id).padStart(6, '0')}`
  const amountText = toVietnameseMoneyText(total)
  const statusLabel = item.trangThaiThanhToan === 'PUBLISHED' ? 'ĐÃ XUẤT HĐ' : item.trangThaiThanhToan === 'PAID' ? 'ĐÃ THU' : item.trangThaiThanhToan === 'OVERDUE' ? 'QUÁ HẠN' : 'CHƯA THU'
  const receiptImage = item.receiptImageUrl
    ? `<div class="receipt-img-box"><img src="${item.receiptImageUrl}" alt="Ảnh biên nhận" /></div>`
    : ''

  return `
      <section class="receipt-page">
        <div class="receipt-watermark">♻</div>
        <header class="receipt-header">
          <div class="header-left">
            <div class="brand-logo">♻</div>
            <div>
              <h1>${unitInfo.tenDonVi || DEFAULT_UNIT_INFO.tenDonVi}</h1>
              <p>Địa chỉ: ${unitInfo.diaChi || '[Địa chỉ đơn vị]'}</p>
              <p>Điện thoại: ${unitInfo.soDienThoai || '[Số điện thoại đơn vị]'}</p>
              <p>MST: ${unitInfo.maSoThue || '[Mã số thuế]'}</p>
            </div>
          </div>
          <div class="header-right">
            <h2>PHIẾU THU TIỀN DỊCH VỤ<br />THU GOM RÁC THẢI SINH HOẠT</h2>
            <p>Số phiếu: <strong>${receiptCode}</strong></p>
            <p>Ngày lập: ${issueDate}</p>
            <p>STK: ${unitInfo.soTaiKhoanNganHang || '[Số tài khoản ngân hàng]'}</p>
          </div>
        </header>

        <div class="divider"></div>

        <section class="info-grid">
          <div class="info-item"><span>Mã hộ:</span><strong>${item.household?.maHoDan ?? '---'}</strong></div>
          <div class="info-item"><span>Chủ hộ:</span><strong>${item.household?.tenChuHo ?? '---'}</strong></div>
          <div class="info-item"><span>Địa chỉ:</span><strong>${item.household?.diaChi ?? '---'}</strong></div>
          <div class="info-item"><span>Kỳ hóa đơn:</span><strong>${item.kyHoaDon}</strong></div>
          <div class="info-item"><span>Tuyến đường:</span><strong>${routeName}</strong></div>
          <div class="info-item"><span>Loại dịch vụ:</span><strong>${serviceName}</strong></div>
        </section>

        <section class="money-row">
          <div class="money-box">
            <div class="money-line"><span>Tiền dịch vụ</span><strong>${formatNumber(Number(item.tongTien))} đ</strong></div>
            <div class="money-line"><span>Thuế (${taxPercent}%)</span><strong>${formatNumber(Number(item.thue))} đ</strong></div>
            <div class="money-line total"><span>Tổng thu</span><strong>${formatNumber(total)} đ</strong></div>
            <div class="money-text"><span>Bằng chữ:</span><em>${amountText}</em></div>
          </div>
          <div class="status-box">
            <div class="status-title">Trạng thái:</div>
            <div class="status-value">${statusLabel}</div>
            <div class="status-date">Ngày thu: ${paymentDate}</div>
          </div>
        </section>

        ${item.paymentNote ? `<div class="note">Ghi chú: ${item.paymentNote}</div>` : ''}
        ${receiptImage}

        <footer class="receipt-footer">
          <div>Cảm ơn quý hộ đã chung tay giữ gìn môi trường sạch đẹp!</div>
        </footer>
      </section>
      `
}

async function renderReceiptCanvas(item: InvoiceItem, unitInfo: UnitInfo) {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.zIndex = '-1'
  container.innerHTML = `<style>${RECEIPT_STYLE}</style>${buildReceiptMarkup(item, unitInfo)}`
  document.body.appendChild(container)

  const receiptElement = container.querySelector('.receipt-page') as HTMLElement | null
  if (!receiptElement) {
    document.body.removeChild(container)
    throw new Error('Không tạo được mẫu phiếu để xuất')
  }

  const canvas = await html2canvas(receiptElement, {
    scale: 1.4,
    useCORS: true,
    backgroundColor: '#ffffff',
  })

  document.body.removeChild(container)
  return canvas
}

async function downloadReceipts(items: InvoiceItem[], mode: 'pdf' | 'image', unitInfo: UnitInfo) {
  if (mode === 'pdf') {
    const pdf = new jsPDF('p', 'mm', 'a4')

    for (let index = 0; index < items.length; index += 1) {
      const canvas = await renderReceiptCanvas(items[index], unitInfo)
      const imgData = canvas.toDataURL('image/jpeg', 0.72)
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const renderHeight = Math.min(imgHeight, pageHeight)

      if (index > 0) {
        pdf.addPage()
      }

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, renderHeight, undefined, 'FAST')
    }

    pdf.save(`phieu-thu-${Date.now()}.pdf`)
    return
  }

  for (const item of items) {
    const canvas = await renderReceiptCanvas(item, unitInfo)
    const code = `PT${String(item.id).padStart(6, '0')}`
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((imageBlob) => resolve(imageBlob), 'image/jpeg', 0.78),
    )
    if (blob) {
      saveBlob(blob, `phieu-thu-${code}.jpg`)
    }
  }
}

export function InvoiceCollectionsPage() {
  const [loading, setLoading] = useState(false)
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriodItem[]>([])
  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [services, setServices] = useState<ServiceCatalogItem[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  })

  const [searchValues, setSearchValues] = useState<InvoiceSearchValues>({})
  const [tenChuHoInput, setTenChuHoInput] = useState('')
  const [diaChiInput, setDiaChiInput] = useState('')
  const debouncedTenChuHo = useDebounce(tenChuHoInput, 400)
  const debouncedDiaChi = useDebounce(diaChiInput, 400)
  const [collecting, setCollecting] = useState(false)
  const [collectModalOpen, setCollectModalOpen] = useState(false)
  const [collectTargetIds, setCollectTargetIds] = useState<number[]>([])
  const [collectFileList, setCollectFileList] = useState<UploadFile[]>([])
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [statusTargetInvoice, setStatusTargetInvoice] = useState<InvoiceItem | null>(null)
  const [unitInfo, setUnitInfo] = useState<UnitInfo>(DEFAULT_UNIT_INFO)

  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyData, setHistoryData] = useState<HouseholdInvoiceHistoryResponse | null>(null)
  const [historySelectedUnpaidIds, setHistorySelectedUnpaidIds] = useState<number[]>([])

  const [searchForm] = Form.useForm<InvoiceSearchValues>()
  const [collectForm] = Form.useForm<{ paymentNote?: string }>()
  const [statusForm] = Form.useForm<{ trangThaiThanhToan: InvoicePaymentStatus }>()

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

  const periodOptions = useMemo(
    () =>
      billingPeriods.map((item) => ({
        value: item.maKy,
        label: `${item.tenKy} (${item.maKy})`,
      })),
    [billingPeriods],
  )

  const fetchInvoices = async (
    page = pagination.page,
    limit = pagination.limit,
    filters: InvoiceSearchValues = searchValues,
  ) => {
    setLoading(true)
    try {
      const response = await apiClient.get<PagedResponse<InvoiceItem>>('/invoices', {
        params: {
          page,
          limit,
          kyHoaDon: filters.kyHoaDon,
          tenChuHo: filters.tenChuHo?.trim() || undefined,
          diaChi: filters.diaChi?.trim() || undefined,
          tuyenThuRacId: filters.tuyenThuRacId,
          serviceCatalogId: filters.serviceCatalogId,
          trangThaiThanhToan: filters.trangThaiThanhToan,
        },
      })

      setInvoices(response.data.data)
      setPagination({
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        total: response.data.pagination.total,
      })
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách thu tiền')
    } finally {
      setLoading(false)
    }
  }

  const fetchLookupData = async () => {
    try {
      const [periodResponse, routeResponse, serviceResponse] = await Promise.all([
        apiClient.get<PagedResponse<BillingPeriodItem>>('/billing-periods', { params: { page: 1, limit: 1000 } }),
        apiClient.get<PagedResponse<RouteItem>>('/routes', { params: { page: 1, limit: 1000 } }),
        apiClient.get<PagedResponse<ServiceCatalogItem>>('/service-catalogs', { params: { page: 1, limit: 1000 } }),
      ])

      const periodData = periodResponse.data.data

      setBillingPeriods(periodData)
      setRoutes(routeResponse.data.data)
      setServices(serviceResponse.data.data)

      return periodData
    } catch {
      message.warning('Không tải đủ dữ liệu danh mục lọc')
      return [] as BillingPeriodItem[]
    }
  }

  const fetchUnitInfo = async () => {
    try {
      const response = await apiClient.get<PagedResponse<SystemParameterItem>>('/system-parameters', {
        params: { page: 1, limit: 200 },
      })

      const map = new Map(response.data.data.map((item) => [item.tenThamSo, item.giaTri]))
      const nextUnitInfo: UnitInfo = {
        tenDonVi: map.get('Tên đơn vị')?.trim() || DEFAULT_UNIT_INFO.tenDonVi,
        maSoThue: map.get('Mã số thuế')?.trim() || '',
        soDienThoai: map.get('Số điện thoại')?.trim() || '',
        diaChi: map.get('Địa chỉ')?.trim() || '',
        soTaiKhoanNganHang: map.get('Số tài khoản ngân hàng')?.trim() || '',
      }

      setUnitInfo(nextUnitInfo)
      return nextUnitInfo
    } catch {
      return unitInfo
    }
  }

  useEffect(() => {
    void (async () => {
      await fetchUnitInfo()
      const periodData = await fetchLookupData()
      const latestPeriodCode = periodData[0]?.maKy

      const initialFilters: InvoiceSearchValues = {
        ...searchValues,
        kyHoaDon: latestPeriodCode || searchValues.kyHoaDon,
        tenChuHo: debouncedTenChuHo.trim() || undefined,
        diaChi: debouncedDiaChi.trim() || undefined,
      }

      if (latestPeriodCode && !searchForm.getFieldValue('kyHoaDon')) {
        searchForm.setFieldsValue({ kyHoaDon: latestPeriodCode })
      }

      setSearchValues(initialFilters)
      await fetchInvoices(1, pagination.limit, initialFilters)
    })()
  }, [debouncedTenChuHo, debouncedDiaChi])

  const onSearch = async () => {
    const values = searchForm.getFieldsValue()
    const normalized: InvoiceSearchValues = {
      kyHoaDon: values.kyHoaDon,
      tenChuHo: values.tenChuHo?.trim() || undefined,
      diaChi: values.diaChi?.trim() || undefined,
      tuyenThuRacId: values.tuyenThuRacId,
      serviceCatalogId: values.serviceCatalogId,
      trangThaiThanhToan: values.trangThaiThanhToan,
    }
    setSearchValues(normalized)
    setSelectedRowKeys([])
    await fetchInvoices(1, pagination.limit, normalized)
  }

  const onResetSearch = async () => {
    searchForm.resetFields()
    setTenChuHoInput('')
    setDiaChiInput('')
    const emptyFilter: InvoiceSearchValues = {}
    setSearchValues(emptyFilter)
    setSelectedRowKeys([])
    await fetchInvoices(1, pagination.limit, emptyFilter)
  }

  const openCollectModal = (ids: number[]) => {
    if (ids.length === 0) {
      message.warning('Vui lòng chọn hóa đơn cần thu tiền')
      return
    }

    const unpaidIds = ids.filter((id) => {
      const invoice = invoices.find((item) => item.id === id)
      return invoice?.trangThaiThanhToan !== 'PAID' && invoice?.trangThaiThanhToan !== 'PUBLISHED'
    })

    if (unpaidIds.length === 0) {
      message.warning('Các hóa đơn đã chọn đều đã thu tiền')
      return
    }

    if (unpaidIds.length < ids.length) {
      message.info('Đã bỏ qua các hóa đơn đã thu, chỉ thu các hóa đơn chưa thanh toán')
    }

    setCollectTargetIds(unpaidIds)
    setCollectFileList([])
    collectForm.resetFields()
    setCollectModalOpen(true)
  }

  const closeCollectModal = () => {
    setCollectModalOpen(false)
    setCollectTargetIds([])
    setCollectFileList([])
    collectForm.resetFields()
  }

  const openStatusModal = (invoice: InvoiceItem) => {
    setStatusTargetInvoice(invoice)
    statusForm.setFieldsValue({
      trangThaiThanhToan: invoice.trangThaiThanhToan,
    })
    setStatusModalOpen(true)
  }

  const closeStatusModal = () => {
    setStatusModalOpen(false)
    setStatusTargetInvoice(null)
    statusForm.resetFields()
  }

  const submitStatusUpdate = async () => {
    if (!statusTargetInvoice) {
      return
    }

    const values = await statusForm.validateFields()
    setStatusUpdating(true)
    try {
      await apiClient.patch(`/invoices/${statusTargetInvoice.id}/status`, {
        trangThaiThanhToan: values.trangThaiThanhToan,
      })

      message.success('Cập nhật trạng thái thành công')
      closeStatusModal()
      await fetchInvoices(pagination.page, pagination.limit, searchValues)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái')
    } finally {
      setStatusUpdating(false)
    }
  }

  const submitCollect = async () => {
    const values = await collectForm.validateFields()

    setCollecting(true)
    try {
      const formData = new FormData()
      formData.append('invoiceIds', JSON.stringify(collectTargetIds))
      if (values.paymentNote?.trim()) {
        formData.append('paymentNote', values.paymentNote.trim())
      }

      if (collectFileList[0]?.originFileObj) {
        formData.append('receiptImage', collectFileList[0].originFileObj)
      }

      const response = await apiClient.post('/invoices/collect', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      message.success(response.data?.message ?? 'Thu tiền thành công')
      closeCollectModal()
      setSelectedRowKeys([])
      await fetchInvoices(pagination.page, pagination.limit, searchValues)

      if (historyOpen && historyData?.household.id) {
        await openHistory(historyData.household.id)
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Thu tiền thất bại')
    } finally {
      setCollecting(false)
    }
  }

  const openHistory = async (householdId: number) => {
    setHistoryLoading(true)
    setHistoryOpen(true)
    setHistorySelectedUnpaidIds([])
    try {
      const response = await apiClient.get<HouseholdInvoiceHistoryResponse>(
        `/invoices/household/${householdId}/history`,
      )
      setHistoryData(response.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được lịch sử thu tiền')
      setHistoryOpen(false)
    } finally {
      setHistoryLoading(false)
    }
  }

  const closeHistoryModal = () => {
    setHistoryOpen(false)
    setHistoryData(null)
    setHistorySelectedUnpaidIds([])
  }

  const runGenerateByPeriod = async () => {
    const kyHoaDon = searchForm.getFieldValue('kyHoaDon') as string | undefined
    if (!kyHoaDon) {
      message.warning('Vui lòng chọn kỳ hóa đơn để phát sinh lượt thu')
      return
    }

    try {
      const response = await apiClient.post(`/invoices/generate-from-period/${kyHoaDon}`)
      message.success(response.data?.message ?? 'Đã kiểm tra phát sinh hóa đơn theo kỳ')
      await fetchInvoices(1, pagination.limit, {
        ...searchValues,
        kyHoaDon,
      })
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể phát sinh hóa đơn theo kỳ')
    }
  }

  const loadReceiptsAndDownload = async (invoiceIds: number[], mode: 'pdf' | 'image') => {
    if (invoiceIds.length === 0) {
      message.warning('Vui lòng chọn hóa đơn để tải phiếu')
      return
    }

    try {
      const response = await apiClient.get('/invoices/receipt', {
        params: {
          invoiceIds: invoiceIds.join(','),
        },
      })

      const payload = response.data as { invoices?: InvoiceItem[] }
      const printableInvoices = payload.invoices ?? []
      if (printableInvoices.length === 0) {
        message.warning('Không có dữ liệu phiếu thu để tải')
        return
      }

      const latestUnitInfo = await fetchUnitInfo()
      await downloadReceipts(printableInvoices, mode, latestUnitInfo)
      message.success(mode === 'pdf' ? 'Đã tải file PDF' : 'Đã tải file ảnh')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được file phiếu')
    }
  }

  const publishInvoices = async (invoiceIds: number[]) => {
    if (invoiceIds.length === 0) {
      message.warning('Vui lòng chọn hóa đơn cần phát hành VNPT')
      return
    }

    Modal.confirm({
      title: `Xác nhận phát hành ${invoiceIds.length} hóa đơn VNPT`,
      content: 'Hệ thống sẽ gọi VNPT để phát hành hóa đơn thật. Nếu hóa đơn đang Chưa thu thì sẽ tự chuyển sang Đã thu sau khi phát hành thành công.',
      okText: 'Phát hành',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          const response = await apiClient.post('/invoices/publish', {
            invoiceIds,
          })

          const data = response.data as {
            message?: string
            successCount?: number
            failCount?: number
            results?: Array<{ invoiceId: number; success: boolean; message: string }>
          }

          if ((data.failCount ?? 0) > 0) {
            const failed = (data.results ?? []).filter((item) => !item.success)
            const failDetails = failed.slice(0, 3).map((item) => `#${item.invoiceId}: ${item.message}`).join('\n')
            message.warning(`${data.message ?? 'Phát hành hoàn tất với một số lỗi'}${failDetails ? `\n${failDetails}` : ''}`)
          } else {
            message.success(data.message ?? 'Phát hành VNPT thành công')
          }

          await fetchInvoices(pagination.page, pagination.limit, searchValues)

          if (historyOpen && historyData?.household.id) {
            await openHistory(historyData.household.id)
          }
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Không thể phát hành hóa đơn VNPT')
        }
      },
    })
  }

  const syncInvoiceMetadata = async (invoiceIds: number[]) => {
    if (invoiceIds.length === 0) {
      message.warning('Vui lòng chọn hóa đơn để đồng bộ seri/fkey')
      return
    }

    try {
      const response = await apiClient.post('/invoices/sync-metadata', {
        invoiceIds,
      })

      const data = response.data as {
        message?: string
        successCount?: number
        failCount?: number
        results?: Array<{ invoiceId: number; success: boolean; message: string }>
      }

      if ((data.failCount ?? 0) > 0) {
        const failed = (data.results ?? []).filter((item) => !item.success)
        const failDetails = failed.slice(0, 3).map((item) => `#${item.invoiceId}: ${item.message}`).join('\n')
        message.warning(`${data.message ?? 'Đồng bộ có lỗi'}${failDetails ? `\n${failDetails}` : ''}`)
      } else {
        message.success(data.message ?? 'Đồng bộ seri/fkey thành công')
      }

      await fetchInvoices(pagination.page, pagination.limit, searchValues)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể đồng bộ seri/fkey')
    }
  }

  const downloadVnptInvoice = async (invoiceId: number, output: 'pdf' | 'image') => {
    try {
      const response = await apiClient.get(`/invoices/${invoiceId}/download-vnpt`)
      const payload = response.data as {
        filename: string
        mimeType: string
        content: string
        base64: boolean
      }

      if (!payload?.content) {
        message.warning('VNPT không trả dữ liệu hóa đơn')
        return
      }

      const isPdf = (payload.mimeType || '').includes('pdf')
      const isImage = (payload.mimeType || '').startsWith('image/')
      const isHtml =
        (payload.mimeType || '').includes('text/html') ||
        /<html[\s>]|<!doctype html/i.test(String(payload.content || ''))

      if (isHtml) {
        const htmlContent = String(payload.content)
        const canvas = await renderHtmlAsCanvas(htmlContent)
        if (output === 'pdf') {
          saveCanvasAsPdf(canvas, `hoa-don-${invoiceId}.pdf`)
          message.success('Đã chuyển HTML hóa đơn VNPT sang PDF')
          return
        }

        const imageBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.78)
        })

        if (!imageBlob) {
          throw new Error('Không thể tạo ảnh từ HTML hóa đơn VNPT')
        }

        saveBlob(imageBlob, `hoa-don-${invoiceId}.jpg`)
        message.success('Đã chuyển HTML hóa đơn VNPT sang ảnh')
        return
      }

      if (payload.base64 && isPdf) {
        const pdfBlob = base64ToBlob(payload.content, 'application/pdf')
        if (output === 'pdf') {
          saveBlob(pdfBlob, `hoa-don-${invoiceId}.pdf`)
          message.success('Đã tải hóa đơn PDF từ VNPT')
          return
        }

        message.warning('VNPT trả về PDF gốc, hệ thống sẽ tải PDF để giữ đúng nội dung hóa đơn.')
        saveBlob(pdfBlob, `hoa-don-${invoiceId}.pdf`)
        return
      }

      if (payload.base64 && isImage) {
        const extension = (payload.mimeType || '').includes('png') ? 'png' : 'jpg'
        const imageBlob = base64ToBlob(payload.content, payload.mimeType || 'image/png')

        if (output === 'image') {
          saveBlob(imageBlob, `hoa-don-${invoiceId}.${extension}`)
          message.success('Đã tải hóa đơn ảnh từ VNPT')
          return
        }

        const imageUrl = URL.createObjectURL(imageBlob)
        const img = new window.Image()
        img.src = imageUrl
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Không thể đọc ảnh hóa đơn VNPT'))
        })

        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const context = canvas.getContext('2d')
        if (!context) {
          URL.revokeObjectURL(imageUrl)
          throw new Error('Không thể xử lý ảnh hóa đơn VNPT')
        }
        context.drawImage(img, 0, 0)
        URL.revokeObjectURL(imageUrl)
        saveCanvasAsPdf(canvas, `hoa-don-${invoiceId}.pdf`)
        message.success('Đã chuyển ảnh hóa đơn VNPT sang PDF')
        return
      }

      const textContent = String(payload.content)
      const canvas = await renderTextAsCanvas(`Hóa đơn VNPT #${invoiceId}`, textContent)
      const imageBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.78)
      })

      if (!imageBlob) {
        throw new Error('Không thể tạo file ảnh hóa đơn')
      }

      if (output === 'pdf') {
        saveCanvasAsPdf(canvas, `hoa-don-${invoiceId}.pdf`)
        message.info('VNPT không trả định dạng chuẩn, hệ thống đã chuyển nội dung thành PDF.')
        return
      }

      saveBlob(imageBlob, `hoa-don-${invoiceId}.jpg`)
      message.info('VNPT không trả HTML/PDF chuẩn, hệ thống đã tải ảnh nội dung hóa đơn.')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể tải hóa đơn VNPT')
    }
  }

  const runBatchInvoiceDownload = async (invoiceIds: number[], output: 'pdf' | 'image') => {
    if (invoiceIds.length === 0) {
      message.warning('Vui lòng chọn hóa đơn để tải')
      return
    }

    for (const id of invoiceIds) {
      // eslint-disable-next-line no-await-in-loop
      await downloadVnptInvoice(id, output)
    }
  }

  return (
    <Card className="page-card" variant="borderless">
      <style>{INVOICE_COLLECTION_UI_STYLE}</style>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space className="invoice-toolbar" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <h3 style={{ margin: 0 }}>Quản lý thu tiền</h3>
          <Space wrap>
            <Button className="toolbar-generate-btn" onClick={runGenerateByPeriod}>
              Phát sinh lượt thu theo kỳ
            </Button>
            <Button
              className="toolbar-collect-btn"
              type="primary"
              icon={<MoneyCollectOutlined />}
              onClick={() => openCollectModal(selectedRowKeys)}
            >
              Thu tiền
            </Button>
            <Button
              className="toolbar-publish-btn"
              type="primary"
              icon={<CloudUploadOutlined />}
              onClick={() => void publishInvoices(selectedRowKeys)}
            >
              Xuất HĐĐT
            </Button>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  {
                    key: 'invoice-pdf',
                    label: 'Tải hóa đơn PDF',
                    icon: <FilePdfOutlined />,
                  },
                  {
                    key: 'invoice-image',
                    label: 'Tải hóa đơn ảnh',
                    icon: <FileImageOutlined />,
                  },
                  {
                    key: 'receipt-pdf',
                    label: 'Tải phiếu thu PDF',
                    icon: <FilePdfOutlined />,
                  },
                  {
                    key: 'receipt-image',
                    label: 'Tải phiếu thu ảnh',
                    icon: <FileImageOutlined />,
                  },
                ],
                onClick: ({ key }) => {
                  if (key === 'invoice-pdf') {
                    void runBatchInvoiceDownload(selectedRowKeys, 'pdf')
                    return
                  }

                  if (key === 'invoice-image') {
                    void runBatchInvoiceDownload(selectedRowKeys, 'image')
                    return
                  }

                  if (key === 'receipt-pdf') {
                    void loadReceiptsAndDownload(selectedRowKeys, 'pdf')
                    return
                  }

                  if (key === 'receipt-image') {
                    void loadReceiptsAndDownload(selectedRowKeys, 'image')
                  }
                },
              }}
            >
              <Button className="toolbar-download-btn" icon={<DownloadOutlined />}>
                Tải dữ liệu <DownOutlined />
              </Button>
            </Dropdown>

            <Button
              className="toolbar-sync-btn"
              icon={<SyncOutlined />}
              onClick={() => void syncInvoiceMetadata(selectedRowKeys)}
            >
              Đồng bộ HĐ
            </Button>
          </Space>
        </Space>

        <Card size="small" style={{ background: '#f8fbfc' }}>
          <Form form={searchForm} layout="inline">
            <Space wrap size={8} style={{ width: '100%' }}>
              <Form.Item name="kyHoaDon" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  style={{ width: 220 }}
                  options={periodOptions}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Kỳ hóa đơn"
                />
              </Form.Item>
              <Form.Item name="tenChuHo" style={{ marginBottom: 0 }}>
                <Input
                  style={{ width: 200 }}
                  placeholder="Tên hộ dân"
                  value={tenChuHoInput}
                  onChange={(e) => setTenChuHoInput(e.target.value)}
                />
              </Form.Item>
              <Form.Item name="diaChi" style={{ marginBottom: 0 }}>
                <Input
                  style={{ width: 240 }}
                  placeholder="Địa chỉ"
                  value={diaChiInput}
                  onChange={(e) => setDiaChiInput(e.target.value)}
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
                  onChange={(val) => {
                    const next = { ...searchValues, tuyenThuRacId: val }
                    setSearchValues(next)
                    void fetchInvoices(1, pagination.limit, next)
                  }}
                />
              </Form.Item>
              <Form.Item name="serviceCatalogId" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  style={{ width: 220 }}
                  options={serviceOptions}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Loại dịch vụ"
                  onChange={(val) => {
                    const next = { ...searchValues, serviceCatalogId: val }
                    setSearchValues(next)
                    void fetchInvoices(1, pagination.limit, next)
                  }}
                />
              </Form.Item>
              <Form.Item name="trangThaiThanhToan" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  style={{ width: 160 }}
                  options={PAYMENT_STATUS_OPTIONS}
                  placeholder="Trạng thái"
                  onChange={(val) => {
                    const next = { ...searchValues, trangThaiThanhToan: val }
                    setSearchValues(next)
                    void fetchInvoices(1, pagination.limit, next)
                  }}
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button onClick={() => void onResetSearch()}>Đặt lại</Button>
              </Form.Item>
            </Space>
          </Form>
        </Card>

        <div className="invoice-table-wrap">
          {loading && invoices.length === 0 ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : (
            <Table<InvoiceItem>
              rowKey="id"
              bordered
              size="middle"
              loading={loading}
              dataSource={invoices}
              rowClassName={(_, index) => (index % 2 === 0 ? 'row-even' : 'row-odd')}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys as number[]),
              }}
              columns={[
                {
                  title: 'Kỳ',
                  dataIndex: 'kyHoaDon',
                  width: 110,
                },
                {
                  title: 'Mã hộ',
                  render: (_, record) => record.household?.maHoDan ?? '---',
                  width: 110,
                },
                {
                  title: 'Hộ dân',
                  render: (_, record) => record.household?.tenChuHo ?? '---',
                  width: 180,
                },
                {
                  title: 'Trạng thái',
                  render: (_, record) => getStatusTag(record.trangThaiThanhToan),
                  width: 120,
                },
                {
                  title: 'Phát hành',
                  render: (_, record) => getPublishStatusTag(record.invoicePublishStatus),
                  width: 130,
                },
                {
                  title: 'Địa chỉ',
                  render: (_, record) => record.household?.diaChi ?? '---',
                  width: 220,
                },
                {
                  title: 'Tuyến đường',
                  render: (_, record) => record.household?.tuyenThuRac?.tenTuyen ?? '---',
                  width: 150,
                },
                {
                  title: 'Loại dịch vụ',
                  render: (_, record) => record.household?.serviceCatalog?.tenDichVu ?? '---',
                  width: 170,
                },
                {
                  title: 'Số seri',
                  dataIndex: 'invoiceSerial',
                  width: 130,
                  render: (value: string | null | undefined) => value || '---',
                },
                {
                  title: 'Fkey',
                  dataIndex: 'invoiceFkey',
                  width: 180,
                  render: (value: string | null | undefined) => value || '---',
                },
                {
                  title: 'Ngày phát hành',
                  dataIndex: 'invoiceIssuedAt',
                  width: 170,
                  render: (value: string | null | undefined) =>
                    value ? new Date(value).toLocaleString('vi-VN') : '---',
                },
                {
                  title: 'Người xuất',
                  render: (_, record) => record.publishedByName || '---',
                  width: 140,
                },
                {
                  title: 'Người thu',
                  render: (_, record) => record.collectedByName || '---',
                  width: 140,
                },
                {
                  title: 'Tổng tiền',
                  render: (_, record) => formatCurrency(Number(record.tongTien) + Number(record.thue)),
                  width: 150,
                },
                {
                  title: 'Ảnh biên nhận',
                  render: (_, record) =>
                    record.receiptImageUrl ? (
                      <Image
                        width={48}
                        height={48}
                        style={{ objectFit: 'cover', borderRadius: 8 }}
                        src={record.receiptImageUrl}
                      />
                    ) : (
                      '---'
                    ),
                  width: 120,
                },
                {
                  title: 'Thao tác',
                  width: 340,
                  fixed: 'right',
                  render: (_, record) => (
                    <Space size={4} wrap>
                      <Button
                        className="invoice-action-btn publish"
                        size="small"
                        type="primary"
                        icon={<CloudUploadOutlined />}
                        onClick={() => void publishInvoices([record.id])}
                        disabled={record.invoicePublishStatus === 'SUCCESS'}
                      >
                        Xuất HĐĐT
                      </Button>
                      <Button
                        className="invoice-action-btn collect"
                        type="primary"
                        size="small"
                        disabled={record.trangThaiThanhToan === 'PAID' || record.trangThaiThanhToan === 'PUBLISHED'}
                        onClick={() => openCollectModal([record.id])}
                      >
                        Thu tiền
                      </Button>
                      <Dropdown
                        trigger={["click"]}
                        menu={{
                          items: [
                            {
                              key: 'sync',
                              label: 'Đồng bộ',
                              icon: <SyncOutlined />,
                            },
                            {
                              key: 'history',
                              label: 'Lịch sử',
                              icon: <HistoryOutlined />,
                            },
                            {
                              key: 'status',
                              label: 'Trạng thái',
                              icon: <EditOutlined />,
                            },
                            {
                              type: 'divider',
                            },
                            {
                              key: 'invoice-pdf',
                              label: 'Tải hóa đơn PDF',
                              icon: <FilePdfOutlined />,
                              disabled: !record.invoiceFkey,
                            },
                            {
                              key: 'invoice-image',
                              label: 'Tải hóa đơn ảnh',
                              icon: <FileImageOutlined />,
                              disabled: !record.invoiceFkey,
                            },
                            {
                              key: 'receipt-pdf',
                              label: 'Tải phiếu thu PDF',
                              icon: <FilePdfOutlined />,
                            },
                            {
                              key: 'receipt-image',
                              label: 'Tải phiếu thu ảnh',
                              icon: <FileImageOutlined />,
                            },
                          ],
                          onClick: ({ key }) => {
                            if (key === 'sync') {
                              void syncInvoiceMetadata([record.id])
                              return
                            }

                            if (key === 'history') {
                              void openHistory(record.householdId)
                              return
                            }

                            if (key === 'status') {
                              openStatusModal(record)
                              return
                            }

                            if (key === 'invoice-pdf') {
                              void downloadVnptInvoice(record.id, 'pdf')
                              return
                            }

                            if (key === 'invoice-image') {
                              void downloadVnptInvoice(record.id, 'image')
                              return
                            }

                            if (key === 'receipt-pdf') {
                              void loadReceiptsAndDownload([record.id], 'pdf')
                              return
                            }

                            if (key === 'receipt-image') {
                              void loadReceiptsAndDownload([record.id], 'image')
                            }
                          },
                        }}
                      >
                        <Button
                          className="invoice-action-btn download"
                          size="small"
                          icon={<DownOutlined />}
                        >
                          Khác
                        </Button>
                      </Dropdown>
                    </Space>
                  ),
                },
            ]}
            scroll={{ x: 2500 }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: (total) => `Tổng: ${total} hóa đơn`,
              onChange: (page, pageSize) => {
                void fetchInvoices(page, pageSize, searchValues)
              },
            }}
          />
          )}
        </div>
      </Space>

      <Modal
        title={`Xác nhận thu tiền (${collectTargetIds.length} hóa đơn)`}
        open={collectModalOpen}
        onCancel={closeCollectModal}
        onOk={() => void submitCollect()}
        okText="Xác nhận thu"
        cancelText="Hủy"
        confirmLoading={collecting}
      >
        <Form form={collectForm} layout="vertical">
          <Form.Item name="paymentNote" label="Ghi chú thu tiền">
            <Input.TextArea rows={3} placeholder="Ví dụ: Thu tiền tại nhà, người nhận: Nguyễn Văn A" />
          </Form.Item>
          <Form.Item label="Ảnh biên nhận (tùy chọn)">
            <Upload
              listType="picture"
              maxCount={1}
              fileList={collectFileList}
              beforeUpload={() => false}
              onChange={({ fileList }) => setCollectFileList(fileList)}
              accept="image/*"
            >
              <Button icon={<UploadOutlined />}>Tải ảnh biên nhận</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Lịch sử thu tiền hộ dân"
        open={historyOpen}
        onCancel={closeHistoryModal}
        footer={[
          <Button key="close" onClick={closeHistoryModal}>
            Đóng
          </Button>,
          <Button
            key="publish-paid"
            icon={<SendOutlined />}
            style={{ background: '#0a5bd8', borderColor: '#0a5bd8', color: '#fff' }}
            disabled={!historyData?.invoices || !historyData.invoices.some((inv) => inv?.trangThaiThanhToan !== 'PUBLISHED')}
            onClick={() => {
              const ids = (historyData?.invoices ?? [])
                .filter((inv) => inv && inv.trangThaiThanhToan !== 'PUBLISHED')
                .map((inv) => inv.id)
              if (ids.length > 0) {
                void publishInvoices(ids)
              }
            }}
          >
            Xuất HĐĐT các tháng chưa xuất
          </Button>,
          <Button
            key="collect-unpaid"
            type="primary"
            disabled={historySelectedUnpaidIds.length === 0}
            onClick={() => {
              openCollectModal(historySelectedUnpaidIds)
            }}
          >
            Thu các tháng đã chọn
          </Button>,
        ]}
        width={1000}
      >
        {historyLoading || !historyData ? null : (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div>
              <strong>{historyData.household?.tenChuHo ?? '-'}</strong> - {historyData.household?.maHoDan ?? '-'}
              <br />
              <span>{historyData.household?.diaChi ?? '-'}</span>
            </div>

            <Space>
              <Tag color="blue">Tổng: {historyData.summary?.total ?? 0}</Tag>
              <Tag color="success">Đã thu: {historyData.summary?.paid ?? 0}</Tag>
              <Tag color="warning">Chưa thu: {historyData.summary?.unpaid ?? 0}</Tag>
            </Space>

            <Table<InvoiceItem>
              rowKey="id"
              size="small"
              dataSource={historyData.invoices ?? []}
              pagination={false}
              scroll={{ x: 1000 }}
              rowSelection={{
                selectedRowKeys: historySelectedUnpaidIds,
                onChange: (keys) => setHistorySelectedUnpaidIds(keys as number[]),
                getCheckboxProps: (record) => ({
                  disabled: !record || record.trangThaiThanhToan === 'PAID' || record.trangThaiThanhToan === 'PUBLISHED',
                }),
              }}
              columns={[
                { title: 'Kỳ', dataIndex: 'kyHoaDon', width: 100 },
                {
                  title: 'Tổng tiền',
                  render: (_, record) => record ? formatCurrency(Number(record.tongTien || 0) + Number(record.thue || 0)) : '-',
                  width: 130,
                },
                {
                  title: 'Trạng thái',
                  render: (_, record) => record ? getStatusTag(record.trangThaiThanhToan) : '-',
                  width: 120,
                },
                {
                  title: 'Phát hành VNPT',
                  render: (_, record) => record ? getPublishStatusTag(record.invoicePublishStatus) : '-',
                  width: 130,
                },
                {
                  title: 'Kỳ gộp',
                  render: (_, record) => record?.mergedPeriodCodes || record?.kyHoaDon || '-',
                  width: 150,
                },
                {
                  title: 'Người xuất',
                  render: (_, record) => record?.publishedByName || '---',
                  width: 130,
                },
                {
                  title: 'Người thu',
                  render: (_, record) => record?.collectedByName || '---',
                  width: 130,
                },
                {
                  title: 'Ngày thu',
                  render: (_, record) =>
                    record?.paymentDate ? new Date(record.paymentDate).toLocaleString('vi-VN') : '---',
                  width: 160,
                },
                {
                  title: 'Xuất HĐ điện tử',
                  key: 'publish',
                  width: 145,
                  fixed: 'right',
                  render: (_, record) => {
                    if (!record) return null
                    if (record.trangThaiThanhToan === 'PUBLISHED') {
                      return <Tag color="processing">Đã phát hành</Tag>
                    }
                    const isUnpaid = record.trangThaiThanhToan === 'UNPAID' || record.trangThaiThanhToan === 'OVERDUE'
                    return (
                      <Popconfirm
                        title="Xuất hóa đơn điện tử"
                        description={
                          isUnpaid
                            ? `Hóa đơn kỳ ${record.kyHoaDon} đang chưa thu. Phát hành VNPT sẽ tự động thu tiền và xuất HĐ. Xác nhận xuất?`
                            : `Xác nhận xuất HĐ điện tử kỳ ${record.kyHoaDon}?`
                        }
                        okText="Xuất HĐ"
                        cancelText="Hủy"
                        onConfirm={() => void publishInvoices([record.id])}
                      >
                        <Button
                          size="small"
                          type="primary"
                          icon={<SendOutlined />}
                          style={{ background: '#0a5bd8', borderColor: '#0a5bd8' }}
                        >
                          Xuất HĐ
                        </Button>
                      </Popconfirm>
                    )
                  },
                },
              ]}
            />
          </Space>
        )}
      </Modal>

      <Modal
        title="Cập nhật trạng thái hóa đơn"
        open={statusModalOpen}
        onCancel={closeStatusModal}
        onOk={() => void submitStatusUpdate()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={statusUpdating}
      >
        <Form form={statusForm} layout="vertical">
          <Form.Item
            name="trangThaiThanhToan"
            label="Trạng thái thanh toán"
            rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
          >
            <Select options={PAYMENT_STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
