import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers(){
    return [{source:'/(.*)',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'Permissions-Policy',value:'camera=(self), geolocation=(self), microphone=(self), payment=()'},
      {key:'Content-Security-Policy',value:"default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' https://telegram.org 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://*.khmerx.org https://api.telegram.org https://gatewayapi.telegram.org"},
      {key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'}
    ]}]
  }
};

export default nextConfig;
