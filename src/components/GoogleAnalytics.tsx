import Script from 'next/script';

import { IS_GLYPHFIELD_ORIGIN } from '@/lib/seo';

/* The site's GA4 measurement ID. It is public: every page that loads the tag sends it. */
const GA_ID = 'G-6Y0QP2NLMS';

/* Consent Mode v2 defaults, set before gtag.js loads: no ad storage or ad
   personalization anywhere, and visits from the EEA, the UK and Switzerland
   measured without analytics cookies. */
const GA_BOOT = [
  'window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}',
  "gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',region:['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','CH','GB']});",
  "gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});",
  `gtag('js',new Date());gtag('config','${GA_ID}');`,
].join('');

/**
 * Google Analytics 4, on Glyphfield's own production deployments only.
 * Previews, local servers, test runs and self-hosted copies (which set their
 * own NEXT_PUBLIC_STUDIO_URL) render nothing and send no hits. Client
 * navigations are counted by GA4's enhanced measurement (history events), so
 * no page view is sent by hand.
 */
export default function GoogleAnalytics() {
  if (process.env.VERCEL_ENV !== 'production' || !IS_GLYPHFIELD_ORIGIN) return null;
  return (
    <>
      <Script id='ga-consent' strategy='afterInteractive'>
        {GA_BOOT}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy='afterInteractive' />
    </>
  );
}
