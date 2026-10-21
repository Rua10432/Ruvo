/// <reference types="vite/client" />
/// <reference types="mdui/jsx.zh-cn.d.ts" />

import "react";

declare module "react" {
  interface HTMLAttributes<T> {
    size?: string;
  }
}
