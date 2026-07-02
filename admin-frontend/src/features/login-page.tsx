import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'

interface LoginPageProps {
  loading: boolean
  errorMessage: string | null
  onSubmit: (values: { taiKhoanOrSoGiayTo: string; matKhau: string }) => void
}

export function LoginPage({ loading, errorMessage, onSubmit }: LoginPageProps) {
  return (
    <div className="login-shell">
      <Card className="login-card" variant="borderless">
        <Typography.Text className="login-badge">
          Ban Quản lý phường An Khê
        </Typography.Text>
        <Typography.Title level={2} className="login-title">
          Đăng nhập trang quản trị
        </Typography.Title>
        <Typography.Paragraph className="login-subtitle">
          Đăng nhập bằng tài khoản và mật khẩu hoặc số CCCD/CMND và mật khẩu.
        </Typography.Paragraph>

        {errorMessage ? (
          <Alert
            type="error"
            showIcon
            message={errorMessage}
            style={{ marginBottom: 16 }}
          />
        ) : null}

        <Form layout="vertical" onFinish={onSubmit} autoComplete="off">
          <Form.Item
            label="Tài khoản hoặc CCCD/CMND"
            name="taiKhoanOrSoGiayTo"
            rules={[{ required: true, message: 'Vui lòng nhập tài khoản hoặc CCCD/CMND' }]}
          >
            <Input
              size="large"
              prefix={<UserOutlined />}
              placeholder="admin01 hoặc 0792xxxxxx"
            />
          </Form.Item>

          <Form.Item
            label="Mật khẩu"
            name="matKhau"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder="Nhập mật khẩu"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={loading}
            className="login-submit"
          >
            Đăng nhập
          </Button>
        </Form>
      </Card>
    </div>
  )
}
