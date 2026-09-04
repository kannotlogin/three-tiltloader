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

uniform vec4 u_ambient_light_color;
uniform vec4 u_SceneLight_0_color;
uniform vec4 u_SceneLight_1_color;
uniform float u_Shininess;   // Should be in [0.0, 1.0].
uniform vec3 u_SpecColor;

in vec4 v_color;
in vec3 v_normal;
in vec3 v_tangent;
in vec3 v_bitangent;
in vec3 v_position;
in vec3 v_light_dir_0;
in vec3 v_light_dir_1;
in vec2 v_texcoord0;
in float f_fog_coord;

uniform sampler2D u_MainTex;
uniform float u_Cutoff;

uniform highp vec4 u_time;
uniform highp float u_AudioVolume;
uniform highp vec4 u_BeatFFT;

float dispAmount = .0005;

uniform vec4 u_BumpMap_TexelSize;

// HACK: Workaround for GPUs which struggle with vec3/vec2 derivatives.
vec3 xxx_dFdx3(vec3 v) {
  return vec3(dFdx(v.x), dFdx(v.y), dFdx(v.z));
}
vec3 xxx_dFdy3(vec3 v) {
  return vec3(dFdy(v.x), dFdy(v.y), dFdy(v.z));
}
vec2 xxx_dFdx2(vec2 v) {
  return vec2(dFdx(v.x), dFdx(v.y));
}
vec2 xxx_dFdy2(vec2 v) {
  return vec2(dFdy(v.x), dFdy(v.y));
}
// </HACK>

vec3 computeLighting(vec3 diffuseColor, vec3 specularColor, vec3 normal) {
  if (!gl_FrontFacing) {
    normal *= -1.0;
  }
  vec3 lightDir0 = normalize(v_light_dir_0);
  vec3 lightDir1 = normalize(v_light_dir_1);
  vec3 eyeDir = -normalize(v_position);

  vec3 lightOut0 = SurfaceShaderSpecularGloss(normal, lightDir0, eyeDir, u_SceneLight_0_color.rgb,
      diffuseColor, specularColor, u_Shininess);
  vec3 lightOut1 = ShShaderWithSpec(normal, lightDir1, u_SceneLight_1_color.rgb, diffuseColor, u_SpecColor);
  vec3 ambientOut = diffuseColor * u_ambient_light_color.rgb;

  return (lightOut0 + lightOut1 + ambientOut);
}

void main() {
  vec4 tex = texture(u_MainTex, v_texcoord0);
  vec3 normal = PerturbNormal(v_tangent, v_bitangent, v_normal, v_texcoord0);

  float audioActive = step(0.001, u_AudioVolume);
  float lowMidBeat = pow(u_BeatFFT.y, 2.0);

  float scrollNormal = u_time.z;
  float scrollAudio = u_time.y * 5.0 + lowMidBeat * 30.0;
  float scroll = mix(scrollNormal, scrollAudio, audioActive);

  tex.rgb = vec3(1.0, 0.0, 0.0) * (sin(tex.r * 2.0 + scroll*0.5 - v_texcoord0.x) + 1.0) * 2.0;
  tex.rgb += vec3(0.0, 1.0, 0.0) * (sin(tex.r * 3.3 + scroll*1.0 - v_texcoord0.x) + 1.0) * 2.0;
  tex.rgb += vec3(0.0, 0.0, 1.0) * (sin(tex.r * 4.66 + scroll*0.25 - v_texcoord0.x) + 1.0) * 2.0;

  float colorMultiplier = 0.5; 
  vec3 specularColor = u_SpecColor * tex.rgb * colorMultiplier;
  vec3 diffuseColor = tex.rgb * v_color.rgb * colorMultiplier;
  
  diffuseColor = mix(diffuseColor, tex.rgb * v_color.rgb * 0.2, audioActive);
  specularColor = mix(specularColor, specularColor * 0.5, audioActive);
  
  fragColor.rgb = ApplyFog(computeLighting(diffuseColor, specularColor, normal), f_fog_coord);
  fragColor.a = 1.0;

  if (tex.w <= u_Cutoff) {
     discard;
  }
}