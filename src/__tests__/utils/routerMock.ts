import { jest } from '@jest/globals';

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  setParams: jest.fn(),
  pathname: '/',
  segments: [] as string[],
};

export const setMockPathname = (newPathname: string) => {
  mockRouter.pathname = newPathname;
  mockRouter.segments = newPathname.split('/').filter(Boolean);
};

export const resetMockRouter = () => {
  mockRouter.push.mockReset();
  mockRouter.replace.mockReset();
  mockRouter.back.mockReset();
  mockRouter.setParams.mockReset();
  setMockPathname('/');
}; 