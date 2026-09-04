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

uniform sampler2D u_MainTex;
uniform vec4 u_time;
uniform float u_AudioVolume;
uniform vec4 u_BeatFFT;

in vec4 v_color;
in vec2 v_texcoord0;
in vec4 v_unbloomedColor;

vec4 GetWaveForm(vec2 texcoord){
  vec4 _Time = u_time;
  float audioActive = step(0.001, u_AudioVolume);

  float envelope = sin(texcoord.x * 3.14159);

  float normalWaveform = .15 * sin(-30. * v_unbloomedColor.r * _Time.w + texcoord.x * 100. * v_unbloomedColor.r);
  normalWaveform += .15 * sin(-40. * v_unbloomedColor.g * _Time.w + texcoord.x * 100. * v_unbloomedColor.g);
  normalWaveform += .15 * sin(-50. * v_unbloomedColor.b * _Time.w + texcoord.x * 100. * v_unbloomedColor.b);

  float audioWaveform = sin(texcoord.x * 30.0 - _Time.y * 15.0) * u_BeatFFT.y * 0.5;

  float waveform = mix(normalWaveform, audioWaveform, audioActive);

  float pinch = (1. - envelope) * 40. + 20.;
  float procedural_line = clamp(1. - pinch*abs(texcoord.y - .5 - waveform * envelope), 0., 1.);
  
  vec4 color = vec4(1.);
  color.rgb *= envelope * procedural_line;
  color = v_color * color;
  return color;
}

void main() {
  fragColor = GetWaveForm(v_texcoord0.xy);
}