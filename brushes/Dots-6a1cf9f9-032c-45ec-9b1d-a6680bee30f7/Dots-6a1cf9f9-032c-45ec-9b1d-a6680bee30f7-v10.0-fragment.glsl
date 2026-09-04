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
in float v_waveform;

uniform sampler2D u_MainTex;
uniform vec4 u_TintColor;
uniform float u_EmissionGain;
uniform float u_BaseGain;

uniform highp float u_AudioVolume;

void main() {
  float audioActive = step(0.001, u_AudioVolume);
  vec2 uv = v_texcoord0;
  
  float vDistance = abs(uv.y - 0.5) * 2.0;
  float vStretched = (uv.y - 0.5) * (0.5 - abs(v_waveform)) * 2.0 + 0.5;
  uv.y = mix(uv.y, mix(vStretched, uv.y, vDistance), audioActive);
  
  vec4 tex = texture(u_MainTex, uv);
  vec4 c = v_color * u_TintColor * u_BaseGain * tex;
  c.rgb += c.rgb * c.a * u_EmissionGain;

  fragColor.rgb = c.rgb;
  fragColor.a = 1.0;
}