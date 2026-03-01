'use strict';

class ApiPaginator {
  constructor() {
    this.defaultLimit = 20;
    this.maxLimit = 100;
  }

  paginate(array, { page, limit, baseUrl } = {}) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(this.maxLimit, Math.max(1, parseInt(limit, 10) || this.defaultLimit));
    const total = array.length;
    const totalPages = Math.ceil(total / l) || 1;
    const start = (p - 1) * l;
    const data = array.slice(start, start + l);

    const base = baseUrl || '';
    const links = {
      self: `${base}?page=${p}&limit=${l}`,
      first: `${base}?page=1&limit=${l}`,
      last: `${base}?page=${totalPages}&limit=${l}`
    };
    if (p > 1) {
      links.prev = `${base}?page=${p - 1}&limit=${l}`;
    }
    if (p < totalPages) {
      links.next = `${base}?page=${p + 1}&limit=${l}`;
    }

    return {
      data,
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages,
        links
      }
    };
  }

  async initialize() {
    // No-op — stateless utility
  }

  destroy() {
    // No-op — stateless utility
  }
}

module.exports = ApiPaginator;
