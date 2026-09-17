/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'cmswap.mypinata.cloud' },
            { protocol: 'https', hostname: 'gateway.pinata.cloud' },
            { protocol: 'https', hostname: 'coin-images.coingecko.com' },
            { protocol: 'https', hostname: 'raw.githubusercontent.com' },
            { protocol: 'https', hostname: 'dd.dexscreener.com' },
            { protocol: 'https', hostname: '*.r2.dev' }, // Durianfun token logos (Cloudflare R2)
        ],
        minimumCacheTTL: 2592000,
        dangerouslyAllowSVG: true,
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    },
    webpack: (config, { dev }) => {
        if (dev) {
            config.module.rules.push({
                test: /\.(tsx|jsx)$/,
                exclude: /node_modules/,
                use: [{ loader: '@locator/webpack-loader', options: { env: 'development' } }],
            })
        }
        config.resolve.fallback = { fs: false, net: false, tls: false }
        config.externals.push('pino-pretty', 'lokijs', 'encoding')
        config.module.rules.push({
            test: /\.(frag|vert|glsl)$/,
            type: 'asset/source',
        })
        return config
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },
}

export default nextConfig
