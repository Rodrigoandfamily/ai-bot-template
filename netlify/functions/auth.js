const requestCounts = new Map();

exports.rateLimit = (ip) => {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 30;
  const requests = requestCounts.get(ip) || [];
  const recent = requests.filter(t => t > now - windowMs);
  if (recent.length >= maxRequests) return false;
  recent.push(now);
  requestCounts.set(ip, recent);
  return true;
};

exports.corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};