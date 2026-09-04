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

// Brush-specific shader for GlTF web preview, based on Additive.glsl
// generator with parameters: g=0.2.

precision mediump float;

out vec4 fragColor;
  
uniform sampler2D u_MainTex;
uniform vec4 u_time; 

uniform float u_AudioVolume;
uniform vec4 u_BeatFFT;

in vec4 v_color; 
in vec2 v_texcoord0;

void main() {
  float audioActive = step(0.001, u_AudioVolume);
  
  vec3 A     = vec3(0.55, 0.3, 0.7 );
  vec3 aRate = vec3(1.2 , 1.0, 1.33);
  vec3 M     = vec3(1.0 , 2.2, 1.5); 
  vec3 bRate = vec3(1.5 , 3.0, 2.25) + M * aRate;
  vec3 LINE_POS = vec3(0.5,0.5,0.5);
  vec3 LINE_WIDTH = vec3(.012,.012,.012);

  vec2 tc = v_texcoord0;
  float waveformcoord = tc.x * 0.2;
  float envelope = sin(3.14159 * waveformcoord);
  float waveform = sin(waveformcoord * 40.0 - u_time.y * 20.0) * u_BeatFFT.y * 1.5;
  
  tc.y += (waveform * envelope * 0.5) * audioActive;

  vec3 us, vs;
  {
    us = A * tc.x - aRate * u_time.y;

    vec3 tmp = M*A * tc.x - bRate * u_time.y;
    tmp = abs(fract(tmp) - 0.5);
    vs = tc.y + .4 * v_color.a * vec3(1.,-1.,1.) * tmp;
    vs = clamp(mix((vs - .5) * 4., vs,  sin( (3.14159/2.) * v_color.a)),0.,1.);
  }

  vec4 tex = texture(u_MainTex, vec2( abs(us[0]), vs[0]));
  tex += texture(u_MainTex, vec2(us[1], vs[1]));
  tex += texture(u_MainTex, vec2(us[2], vs[2]));

  vec3 procline = vec3(1.,1.,1.) - clamp(pow((vs - LINE_POS)/LINE_WIDTH, vec3(2.,2,.2)),0.,1.);
  tex += dot(procline, vec3(1,1,1)) * .5;

  tex.rgb *= .8 * (1. + 30. * pow((vec3(1.,1,.1) - vec3(v_color.a,v_color.a,v_color.a)), vec3(5.,5.,5.)));
  tex *= v_color;                

  fragColor = vec4(tex.rgb * tex.a, 1.0);
}