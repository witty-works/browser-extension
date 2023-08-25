import defaultConfig from '../witty.config.json';
import { browser } from 'webextension-polyfill-ts';
import { getDomainWithoutSubdomain } from '../shared/utils';
import { StorageKeys } from '../shared/constants';
import { sendErrorToSentry } from '../shared/errorUtils';
import {
  renderDomainDeactivated,
  renderMainPopup,
  renderPopupChrome,
  renderUserNotLoggedIn,
} from './PopupUtils';

const renderPopup = async (isLocked: boolean = false) => {
  browser.storage.local
    .get(null)
    .then((result) => {
      if (!result[StorageKeys.ACCESS_TOKEN]) {
        renderUserNotLoggedIn();
        return;
      }
      let domain = getDomainWithoutSubdomain(window.location.hostname);
      if ((!window.location.protocol.includes('http') &&
        !window.location.protocol.includes('https')) || 
        (!domain)
      ) {
        domain = '';
      }

      if (
        (result[StorageKeys.ORGANIZATION_DOMAINS] &&
          result[StorageKeys.ORGANIZATION_DOMAINS].type === 'deny' &&
          result[StorageKeys.ORGANIZATION_DOMAINS].list &&
          result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain)) ||
        (result[StorageKeys.ORGANIZATION_DOMAINS] &&
          result[StorageKeys.ORGANIZATION_DOMAINS].type === 'allow' &&
          result[StorageKeys.ORGANIZATION_DOMAINS].list &&
          !result[StorageKeys.ORGANIZATION_DOMAINS].list.includes(domain))
      ) {
        isLocked = true;
      }

      const domainsConfrimedToWork = result[
        StorageKeys.DOMAINS_CONFIRMED_TO_WORK
      ]
        ? result[StorageKeys.DOMAINS_CONFIRMED_TO_WORK].filter((d: string) => {
            const domainTimestamp = d.split('-')[1];
            const domainDate = new Date(parseInt(domainTimestamp));
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            return domainDate > threeMonthsAgo;
          })
        : [];

      const domainsConfirmedToNotWork = result[
        StorageKeys.DOMAINS_CONFIRMED_TO_NOT_WORK
      ]
        ? result[StorageKeys.DOMAINS_CONFIRMED_TO_NOT_WORK].filter(
            (d: string) => {
              const domainTimestamp = d.split('-')[1];
              const domainDate = new Date(parseInt(domainTimestamp));
              const threeMonthsAgo = new Date();
              threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
              return domainDate > threeMonthsAgo;
            }
          )
        : [];

      const appId = result[StorageKeys.APP_ID];

      browser.tabs
        .query({ active: true, currentWindow: true })
        .then((tabs) => {
          if (tabs.length != 0 && tabs[0].url) {
            domain = getDomainWithoutSubdomain(new URL(tabs[0].url).hostname);
            if (!domain) return;
            const domainIsConfirmedByUser =
              domainsConfirmedToNotWork
                .map((d: string) => {
                  return d.split('-')[0];
                })
                .includes(domain) ||
              domainsConfrimedToWork
                .map((d: string) => {
                  return d.split('-')[0];
                })
                .includes(domain);
            const domainOnActiveOrDisabledList =
              defaultConfig.ACTIVE_SITES.includes(domain) ||
              defaultConfig.DISABLED_SITES.includes(domain);
            renderPopupChrome(
              appId,
              domain,
              domainOnActiveOrDisabledList,
              domainIsConfirmedByUser,
              domainsConfirmedToNotWork,
              domainsConfrimedToWork,
              result
            );
          } else if (
            defaultConfig.CHROME_AND_FIREFOX_SITES.includes(
              window.location.protocol
            )
          ) {
            const domainOnActiveOrDisabledList =
              defaultConfig.ACTIVE_SITES.includes(domain) ||
              defaultConfig.DISABLED_SITES.includes(domain);
            const domainIsConfirmedByUser =
              domainsConfirmedToNotWork.includes(domain) ||
              domainsConfrimedToWork.includes(domain);

            renderMainPopup(
              appId,
              domain,
              domainOnActiveOrDisabledList,
              domainIsConfirmedByUser,
              domainsConfirmedToNotWork,
              domainsConfrimedToWork,
              isLocked
            );
          } else {
            renderDomainDeactivated(appId, domain);
          }
        })
        .catch((error: unknown) => {
          sendErrorToSentry(error);
        });
    })
    .catch((error: unknown) => {
      sendErrorToSentry(error);
    });
};

const storageChange = (changes: any) => {
  let changedItems = Object.keys(changes);
  for (let item of changedItems) {
    switch (item) {
      case StorageKeys.ACCESS_TOKEN:
        !changes[item].newValue && renderUserNotLoggedIn();
        break;
      case StorageKeys.ORGANIZATION_DOMAINS:
        if (
          (changes[item].newValue.type === 'deny' &&
            changes[item].newValue.list?.includes(
              getDomainWithoutSubdomain(window.location.hostname)
            )) ||
          (changes[item].newValue.type === 'allow' &&
            !changes[item].newValue.list?.includes(
              getDomainWithoutSubdomain(window.location.hostname)
            ))
        ) {
          renderPopup(true);
        }
        break;
    }
  }
};

renderPopup();
browser.storage.onChanged.addListener(storageChange);
//TODO call removeListener
