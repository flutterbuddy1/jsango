/**
 * Login Page View for @jsango/admin-ui
 */

export interface LoginViewProps {
  readonly appTitle?: string | undefined;
  readonly error?: string | undefined;
  readonly isSubmitting?: boolean | undefined;
}

export function renderLoginView(props: LoginViewProps): string {
  const { appTitle = 'JSango Admin', error, isSubmitting = false } = props;

  return `
    <div class="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div class="max-w-sm w-full bg-card border border-border rounded-2xl shadow-xl p-8 animate-in fade-in zoom-in-95">
        <div class="text-center mb-8">
          <div class="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-base mx-auto mb-3 shadow-md">
            J
          </div>
          <h1 class="text-lg font-bold text-foreground tracking-tight">${escapeHtml(appTitle)}</h1>
          <p class="text-xs text-muted-foreground mt-1">Sign in to access the administration console</p>
        </div>

        ${
          error
            ? `
          <div class="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200 text-xs font-medium" role="alert">
            ${escapeHtml(error)}
          </div>
        `
            : ''
        }

        <form class="admin-login-form space-y-4" method="POST">
          <div>
            <label for="admin_username" class="block text-xs font-semibold text-foreground/90 mb-1.5">Username or Email</label>
            <input
              type="text"
              id="admin_username"
              name="username"
              required
              autofocus
              class="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label for="admin_password" class="block text-xs font-semibold text-foreground/90 mb-1.5">Password</label>
            <input
              type="password"
              id="admin_password"
              name="password"
              required
              class="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            class="w-full mt-2 py-2.5 px-4 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition flex items-center justify-center space-x-2 shadow-sm"
            ${isSubmitting ? 'disabled' : ''}
          >
            ${isSubmitting ? '<span class="admin-spinner animate-spin">⟳</span>' : ''}
            <span>Sign In</span>
          </button>
        </form>
      </div>

      <div class="mt-8 text-center text-xs text-muted-foreground">
        Powered by <span class="font-semibold text-foreground">JSango</span> backend framework
      </div>
    </div>
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
