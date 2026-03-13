export interface UserLoginType {
  username: string
  password: string
}

export interface UserType {
  username: string
  password: string
  role: string
  roleId: string
  realName?: string
  displayName?: string
  roles?: string[]
  permissions?: string[]
  capabilities?: string[]
}
