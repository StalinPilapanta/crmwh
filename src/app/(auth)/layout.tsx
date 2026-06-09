export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-card p-8 shadow-lg">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">W</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">CRM WhatsApp</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
