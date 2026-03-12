import 'dotenv/config';

const backendTarget =
  process.env.API_PROXY_TARGET?.trim() ||
  `http://localhost:${process.env.PORT?.trim() || '3001'}`;

export default {
  '/api': {
    target: backendTarget,
    secure: false,
    changeOrigin: true
  }
};
