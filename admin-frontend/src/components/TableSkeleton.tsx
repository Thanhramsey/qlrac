import { Card, Skeleton, Space } from 'antd'

interface TableSkeletonProps {
  rows?: number
  columns?: number
}

export function TableSkeleton({ rows = 6 }: TableSkeletonProps) {
  return (
    <Card className="page-card" variant="borderless">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Skeleton.Button active style={{ width: 200, height: 32 }} />
        <Skeleton.Input active style={{ width: '100%', height: 40 }} />
        <Skeleton active paragraph={{ rows }} title={false} />
      </Space>
    </Card>
  )
}

export function CardSkeleton() {
  return (
    <Card className="page-card">
      <Skeleton active paragraph={{ rows: 3 }} title={true} />
    </Card>
  )
}
