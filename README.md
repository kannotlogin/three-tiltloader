# @kannotlogin/three-tiltloader

[![Latest NPM release](https://img.shields.io/npm/v/@kannotlogin/three-tiltloader.svg)](https://www.npmjs.com/package/@kannotlogin/three-tiltloader)

> **Notice of Modifications (Apache 2.0):**
> This repository is a manually forked and modified version of the original `three-tiltloader` by IcosaGallery (branched from commit `045117ab4f9dac540c9d76aa57f3ab7e04367da8`). 
> Changes include bug fixes, the addition of new generation scripts, experimental audio-reactive shaders, and a custom demo environment setup. 
> These modifications are distributed under the same Apache 2.0 License. Original project by IcosaGallery.

Custom three.js loader for the `.tilt` format used by Tilt Brush and Open Brush. The loader will inject the relevant shaders and textures for correct rendering of the file.

Adapted from the initial [TiltLoader](https://github.com/mrdoob/three.js/blob/r128/examples/jsm/loaders/TiltLoader.js) in three.js.

This project aims to provide a simple way to load and render raw .tilt files on the web, using the three.js library.

# Installation

The loader is designed to be used with modern `three.js`. The library has been tested against `r181`, but may work with other releases.

## Important

You need to pass the loader a path to a folder containing all the relevant brushes and textures. This has been included in the NPM package, so you can host the `brushes` folder locally or serve it directly via a CDN like unpkg.

## Install via npm

`npm install --save @kannotlogin/three-tiltloader`

# Example Usage

```js
import { TiltLoader } from '@kannotlogin/three-tiltloader';