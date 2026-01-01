import { redirect } from 'next/navigation'

export default function AccountPage() {
  // Redirect /account to /account/dashboard
  redirect('/account/dashboard')
}
