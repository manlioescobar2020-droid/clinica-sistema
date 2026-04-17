import { RoleName } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: RoleName
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: RoleName
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: RoleName
  }
}