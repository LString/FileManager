{
  "name": "myapp",
  "version": "1.0.0",
  "main": "src/main/main.js",
  "scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "build": "electron-packager . DocManager --platform=win32 --arch=x64 --overwrite"
  },
  "author": "zhl",
  "license": "ISC",
  "description": "",
  "devDependencies": {
    "@babel/core": "^7.26.10",
    "@babel/preset-env": "^7.26.9",
    "@electron-forge/cli": "^7.7.0",
    "@electron-forge/maker-deb": "^7.7.0",
    "@electron-forge/maker-rpm": "^7.7.0",
    "@electron-forge/maker-squirrel": "^7.7.0",
    "@electron-forge/maker-zip": "^7.7.0",
    "@electron-forge/plugin-auto-unpack-natives": "^7.7.0",
    "@electron-forge/plugin-fuses": "^7.7.0",
    "@electron-forge/plugin-webpack": "^7.7.0",
    "@electron/fuses": "^1.8.0",
    "@eslint/js": "^9.26.0",
    "@vue/compiler-sfc": "^3.5.13",
    "@vue/runtime-core": "^3.5.13",
    "babel-loader": "^10.0.0",
    "core-js": "^3.41.0",
    "electron": "^34.3.0",
    "electron-builder": "^26.0.12",
    "electron-rebuild": "^3.2.9",
    "eslint": "^9.26.0",
    "globals": "^16.1.0",
    "typescript-eslint": "^8.32.0",
    "webpack": "^5.98.0",
    "webpack-cli": "^4.10.0"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.1",
    "bwip-js": "^4.5.2",
    "docx": "^9.3.0",
    "electron-is-dev": "^3.0.1",
    "electron-squirrel-startup": "^1.0.1",
    "electron-store": "^7.0.3",
    "flatpickr": "^4.6.13",
    "uuid": "^11.1.0"
  },
  "build": {
    "productName": "文件录入系统",
    "appId": "com.example.documentmgr",
    "win": {
      "target": "nsis",
      "icon": "build/icon.ico"
    },
    "asar": true,
    "files": [
      "dist/**/*",
      "!node_modules"
    ],
    "extraResources": [
      {
        "from": "documents.db",
        "to": "database"
      }
    ]
  }
}