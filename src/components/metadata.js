import Head from 'next/head';

const resources = [
    'https://*.googletagmanager.com',
    'plausible.io',
    'static.cloudflareinsights.com',
    '*.ens-app-v3.pages.dev',
    'https://app.intercom.io',
    'https://widget.intercom.io',
    'https://js.intercomcdn.com',
].join(' ');

const cspContent =
    process.env.NODE_ENV === 'production'
        ? `worker-src 'self'; script-src 'self' 'sha256-UyYcl+sKCF/ROFZPHBlozJrndwfNiC5KT5ZZfup/pPc=' ${resources} 'wasm-unsafe-eval';`
        : "script-src 'self'";

export default function Metadata({ title, description, image }) {
    return (
        <Head>
            <title>{title}</title>
            <link rel='icon' href='/favicon.ico' />
            <meta
                name='viewport'
                content='width=device-width, initial-scale=1'
            />
            <meta name='description' content={description} />
            <meta property='og:title' content={title} />
            <meta property='og:description' content={description} />
            <meta property='og:image' content={image} />
            <meta property='twitter:card' content='summary_large_image' />
            <meta property='twitter:creator' content='@serenae_fansubs' />
            <meta httpEquiv='Content-Security-Policy' content={cspContent} />
        </Head>
    );
}
