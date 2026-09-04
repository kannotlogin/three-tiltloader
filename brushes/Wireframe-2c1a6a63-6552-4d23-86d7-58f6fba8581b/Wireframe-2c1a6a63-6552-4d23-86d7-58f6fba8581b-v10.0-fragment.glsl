// Copyright 2020 The Tilt Brush Authors
// Updated to OpenGL ES 3.0 by the Icosa Gallery Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

precision mediump float;

out vec4 fragColor;

in vec4 v_color;
in vec2 v_texcoord0;

uniform float u_AudioVolume;
uniform vec4 u_BeatFFT;
uniform vec4 u_time;

void main() {
  float audioActive = step(0.001, u_AudioVolume);
  vec2 uv = fract(v_texcoord0);

  float wNormal = 0.0;
  wNormal = (abs(uv.x - 0.5) > 0.45) ? 1.0 : 0.0;
  wNormal += (abs(uv.y - 0.5) > 0.45) ? 1.0 : 0.0;

  float waveform = sin(uv.y * 30.0 - u_time.y * 10.0) * u_BeatFFT.y * 0.3;
  float envelope = sin(uv.y * 3.141569);
  float xAudio = uv.x + waveform * envelope;
  
  float wAudio = (abs(xAudio - 0.5) > 0.5) ? 1.0 : 0.0;

  float w = mix(wNormal, wAudio, audioActive);

  fragColor = v_color * w;
}