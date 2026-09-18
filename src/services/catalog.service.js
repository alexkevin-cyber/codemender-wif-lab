const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');
const productRepo = require('../data/repositories/productRepository');

function isPrivateIPv4(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return true;
    const [a, b, c, d] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && (b >= 64 && b <= 127)) return true; // 100.64.0.0/10
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16
    if (a === 172 && (b >= 16 && b <= 31)) return true; // 172.16.0.0/12
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24, 192.0.2.0/24
    if (a === 192 && b === 88 && c === 99) return true; // 192.88.99.0/24
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
    if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24
    if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24
    if (a >= 224) return true; // Multicast & Reserved (224.0.0.0/4, 240.0.0.0/4, 255.255.255.255)
    return false;
}

function isPrivateIPv6(ip) {
    const normalized = ip.toLowerCase();
    if (normalized === '::' || normalized === '::1' || normalized === '0:0:0:0:0:0:0:0' || normalized === '0:0:0:0:0:0:0:1') return true;
    if (normalized.startsWith('::ffff:')) {
        const ipv4Part = normalized.replace('::ffff:', '');
        if (net.isIPv4(ipv4Part)) {
            return isPrivateIPv4(ipv4Part);
        }
    }
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(normalized)) return true;
    if (normalized.startsWith('ff')) return true;
    return false;
}

function isPrivateAddress(ip) {
    if (net.isIPv4(ip)) return isPrivateIPv4(ip);
    if (net.isIPv6(ip)) return isPrivateIPv6(ip);
    return true;
}

exports.search = (q) => productRepo.filterProducts(q);

exports.fetchRemoteAsset = (target, cb) => {
    let targetUrl;
    try {
        if (typeof target === 'string') {
            targetUrl = new URL(target);
        } else if (target && typeof target === 'object') {
            if (target instanceof URL) {
                targetUrl = target;
            } else if (target.url) {
                targetUrl = new URL(target.url);
            } else if (target.href) {
                targetUrl = new URL(target.href);
            } else {
                return cb(new Error("Forbidden access rule triggered."));
            }
        } else {
            return cb(new Error("Forbidden access rule triggered."));
        }
    } catch (e) {
        return cb(new Error("Forbidden access rule triggered."));
    }

    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
        return cb(new Error("Forbidden access rule triggered."));
    }

    const host = targetUrl.hostname.toLowerCase();
    if (host.includes('internal-network') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) {
        return cb(new Error("Forbidden access rule triggered."));
    }

    const rawHost = host.replace(/^\[|\]$/g, '');
    dns.lookup(rawHost, { all: true }, (err, addresses) => {
        if (err) {
            return cb(err);
        }
        for (const addr of addresses) {
            if (isPrivateAddress(addr.address)) {
                return cb(new Error("Forbidden access rule triggered."));
            }
        }
        const client = targetUrl.protocol === 'https:' ? https : http;
        client.get(targetUrl, (proxyRes) => {
            let body = '';
            proxyRes.on('data', chunk => body += chunk);
            proxyRes.on('end', () => cb(null, body.substring(0, 50)));
        }).on('error', err => cb(err));
    });
};
