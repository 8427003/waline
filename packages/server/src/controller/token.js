const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const helper = require('think-helper');

const BaseRest = require('./rest.js');

module.exports = class extends BaseRest {
  constructor(...args) {
    super(...args);
    this.modelInstance = this.getModel('Users');
  }

  getAction() {
    return this.success(this.ctx.state.userInfo);
  }

  async postAction() {
    const { email, password, code } = this.post();
    const user = await this.modelInstance.select({ email });

    if (think.isEmpty(user) || /^verify:/i.test(user[0].type)) {
      return this.fail();
    }

    const checkPassword = this.checkPassword(password, user[0].password);

    if (!checkPassword) {
      return this.fail();
    }

    const twoFactorAuthSecret = user[0]['2fa'];

    if (twoFactorAuthSecret) {
      const verified = speakeasy.totp.verify({
        secret: twoFactorAuthSecret,
        encoding: 'base32',
        token: code,
        window: 2,
      });

      if (!verified) {
        return this.fail();
      }
    }

    let avatarUrl = user[0].avatar
      ? user[0].avatar
      : await think.service('avatar').stringify({
          mail: user[0].email,
          nick: user[0].display_name,
          link: user[0].url,
        });
    const { avatarProxy } = think.config();

    if (avatarProxy) {
      avatarUrl = avatarProxy + '?url=' + encodeURIComponent(avatarUrl);
    }
    user[0].avatar = avatarUrl;

    const token = jwt.sign(user[0].email, this.config('jwtKey'));

    // 设置 cookie,有效期 7 天
    this.ctx.cookies.set('WALINE_TOKEN', token, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7天有效期
      path: '/',
      httpOnly: true, // 仅服务端可访问
      sameSite: 'lax', // 防止 CSRF
    });

    return this.success({
      ...user[0],
      password: null,
      mailMd5: helper.md5(user[0].email.toLowerCase()),
      token,
    });
  }

  deleteAction() {}
};
