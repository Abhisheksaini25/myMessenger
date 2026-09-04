'use strict';

const Placeholders = {
  async getSet(kind) {
    // Return the default photo asset instead of generating placeholders
    return [(window.STATIC_ASSETS_BASE || 'assets/') + 'birthday_photo.jpg'];
  }
};
