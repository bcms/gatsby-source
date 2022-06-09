export class BCMSImageConfig {
  static localeImageProcessing = false;
  static cmsOrigin = process.env.GATSBY_BCMS_API_ORIGIN || '';
  static publicApiKeyId = process.env.GATSBY_BCMS_API_PUBLIC_KEY || '';
}
