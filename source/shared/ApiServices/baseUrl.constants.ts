export enum BaseUrls {
  ENTITIES_PLATFORMSH = 'https://main-bvxea6i-qh3uq7skrqxzg.de-2.platformsh.site/',
  DIVERSIFIER_LOCAL = 'https://diversifier.lndo.site/api/MNWA3RmpViV2AxlPVBHjEiAASVnlCH0xbDNut7Q9nQBRQoTVWEERgGELl9jU/',
  DIVERSIFIER_PLATFORMSH = 'https://diversifier.develop-sr3snxi-oczmhzy2xpkpc.eu-4.platformsh.site/api/MNWA3RmpViV2AxlPVBHjEiAASVnlCH0xbDNut7Q9nQBRQoTVWEERgGELl9jU/',
  DIVERSIFIER_WW = 'https://diversifier.witty.works/api/MNWA3RmpViV2AxlPVBHjEiAASVnlCH0xbDNut7Q9nQBRQoTVWEERgGELl9jU/',
}

export const DefaultBaseUrlKey: keyof typeof BaseUrls = Object.keys(BaseUrls).find((item, index) => index === 0) as keyof typeof BaseUrls;
console.log('DefaultBaseUrlKey = ', DefaultBaseUrlKey);
