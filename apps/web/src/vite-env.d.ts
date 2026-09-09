/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /**
   * Absolute URL of the public website. Only the Mini App uses it — it is what
   * "Open on web" opens. Unset means the link is not offered.
   */
  readonly VITE_WEB_URL?: string;
  /** Development only: 'true' serves the API from local fixtures. See .env.example. */
  readonly VITE_MOCK_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
