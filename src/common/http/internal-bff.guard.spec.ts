import { UnauthorizedException } from '@nestjs/common';
import { InternalBffGuard } from './internal-bff.guard';

describe('InternalBffGuard', () => {
  const guard = new InternalBffGuard();

  afterEach(() => {
    delete process.env.INTERNAL_API_TOKEN;
  });

  it('recusa requisição sem o token interno do BFF', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {}, socket: {} }),
      }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(
      UnauthorizedException,
    );
  });

  it('aceita requisição com o token interno do BFF', () => {
    process.env.INTERNAL_API_TOKEN = 'a'.repeat(32);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-internal-token': 'a'.repeat(32) },
          socket: {},
        }),
      }),
    };

    expect(guard.canActivate(context as never)).toBe(true);
  });
});
