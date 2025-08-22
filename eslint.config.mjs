import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // 基础 JavaScript 配置
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    plugins: { js },
    extends: ["js/recommended"]
  },

  // 文件类型配置
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs"
    }
  },

  // 全局变量配置
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },

  // TypeScript 配置
  tseslint.configs.recommended,

  // 自定义规则配置（需放在最后）
  {
    rules: {
      "no-unused-vars": "off", 
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ]
    }
  }
]);