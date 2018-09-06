<p align="center"><img src="./app/assets/images/wowscapelogo.png" alt="wowscapelogo"></p>

<h1 align="center"> Ages of Warcraft Launcher</h1>

<p align="center">Join our server without worrying about installing Warcraft, managing `realmlist.wtf`, or ever updating.</p>

## Thanks
A *huge* shutout to the people at Westeroscraft who originally wrote this launcher, which we adapted to serve our needs.

## Development

### Getting Started

**System Requirements**

* [Node.js][nodejs] v10.5.0+

---

**Clone and Install Dependencies**

```console
> git clone
> npm install
```

---

**Launch Application**

```console
> npm start
```

---

**Build Installers**

To build for your current platform.

```console
> npm run dist
```

Build for a specific platform.

| Platform    | Command              |
| ----------- | -------------------- |
| Windows x64 | `npm run dist:win`   |
| macOS       | `npm run dist:mac`   |
| Linux x64   | `npm run dist:linux` |

Builds for macOS may not work on Windows/Linux and vice-versa.
