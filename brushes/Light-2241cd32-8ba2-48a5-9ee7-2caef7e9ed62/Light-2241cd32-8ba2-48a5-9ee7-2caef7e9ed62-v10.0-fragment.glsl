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

uniform float u_EmissionGain;
uniform sampler2D u_MainTex;

uniform float u_AudioVolume;
uniform vec4 u_BeatFFT;

in vec4 v_color;
in vec2 v_texcoord0;

vec4 bloomColor(vec4 color, float gain) {
  float cmin = length(color.rgb) * .05;
  color.rgb = max(color.rgb, vec3(cmin, cmin, cmin));
  color.r = pow(color.r, 2.2);
  color.g = pow(color.g, 2.2);
  color.b = pow(color.b, 2.2);
  color.a = pow(color.a, 2.2);
  color.rgb *= 2.0 * exp(gain * 10.0);
  return color;
}

void main() {
  float audioActive = step(0.001, u_AudioVolume);
  float brush_mask = texture(u_MainTex, v_texcoord0).w;
  
  vec4 color = bloomColor(v_color, u_EmissionGain);
  vec4 audioColor = color;
  audioColor.rgb *= 0.5 + u_BeatFFT.x * 2.0;
  
  fragColor = brush_mask * mix(color, audioColor, audioActive);
}