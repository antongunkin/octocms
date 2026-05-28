export type CmsUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/** Server-side session stored in the sealed `octocms-session` cookie. */
export type CmsSession = {
  user: CmsUser;
  /** GitHub user access token — used when `CMS_GITHUB_TOKEN` is unset. */
  accessToken?: string;
};

/** JSON returned by `GET /api/octocms/auth/session` (no access token). */
export type CmsSessionPublic = {
  user: CmsUser;
};
