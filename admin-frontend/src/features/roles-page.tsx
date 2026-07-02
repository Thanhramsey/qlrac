import { Card, Col, Row, Space, Tag, Typography } from 'antd'
import type { RoleOption } from '../types'

interface RolesPageProps {
  roles: RoleOption[]
  loading: boolean
}

const roleColor: Record<RoleOption['code'], string> = {
  ADMIN: 'red',
  ADMIN_LEVEL_2: 'volcano',
  ACCOUNTANT: 'gold',
  STAFF: 'blue',
}

export function RolesPage({ roles, loading }: RolesPageProps) {
  return (
    <Card loading={loading} className="page-card" variant="borderless">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Quản lý quyền
        </Typography.Title>
        <Typography.Paragraph style={{ margin: 0 }}>
          Danh sách quyền hệ thống hiện tại để phục vụ cho phân quyền người dùng.
        </Typography.Paragraph>

        <Row gutter={[16, 16]}>
          {roles.map((item) => (
            <Col xs={24} sm={12} lg={6} key={item.code}>
              <Card className="role-card">
                <Space direction="vertical" size={8}>
                  <Tag color={roleColor[item.code]}>{item.code}</Tag>
                  <Typography.Text strong>{item.label}</Typography.Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Space>
    </Card>
  )
}
