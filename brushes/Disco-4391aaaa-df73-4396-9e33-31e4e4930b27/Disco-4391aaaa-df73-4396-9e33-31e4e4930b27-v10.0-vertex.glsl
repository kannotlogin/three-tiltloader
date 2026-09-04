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

// Default shader for GlTF web preview.
//
// This shader is used as a fall-back when a brush-specific shader is
// unavailable.

in vec4 a_position;
in vec3 a_normal;
in vec4 a_tangent;
in vec4 a_color;
in vec3 a_texcoord0;
in vec4 a_texcoord1;

out vec4 v_color;
out vec3 v_normal;  // Camera-space normal.
out vec3 v_tangent;
out vec3 v_binormal;
out vec3 v_position;
out vec2 v_texcoord0;
out vec3 v_light_dir_0;  // Camera-space light direction, main light.
out vec3 v_light_dir_1;  // Camera-space light direction, other light.
out float f_fog_coord;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform mat4 u_SceneLight_0_matrix;
uniform mat4 u_SceneLight_1_matrix;
uniform bool u_isNewTiltExporter;

uniform vec4 u_time;
uniform highp float u_AudioVolume;
uniform highp vec4 u_BeatFFT;

void main() {

  float t, uTileRate, waveIntensity;
  float radius = a_texcoord0.z;
  if (u_isNewTiltExporter) {
    // New exporter can bake radius into UV1.x because UV0.z may be truncated.
    float bakedRadius = a_texcoord1.x;
    if (bakedRadius > 0.000001) {
      radius = bakedRadius;
    }
  }

  float audioActive = step(0.001, u_AudioVolume);
  float highMidBeat = pow(u_BeatFFT.z, 2.0);
  float lowMidBeat = pow(u_BeatFFT.y, 2.0);

  float t_normal = u_time.z;
  float uTileRate_normal = 10.0;
  float waveIntensity_normal = 0.6;

  float t_audio = u_time.y * 5.0 + highMidBeat * 5.0;
  float uTileRate_audio = 5.0;
  float waveIntensity_audio = (lowMidBeat * 0.8 + 0.5);

  t = mix(t_normal, t_audio, audioActive);
  uTileRate = mix(uTileRate_normal, uTileRate_audio, audioActive);
  waveIntensity = mix(waveIntensity_normal, waveIntensity_audio, audioActive);

  vec4 pos = a_position;
  
  float waveform = sin(a_texcoord0.x * 20.0 + u_time.y * 10.0) * highMidBeat * 0.2; 
  pos.xyz += mix(vec3(0.0), waveform * a_normal.xyz, audioActive);

  //Ensure the t parameter wraps (1.0 becomes 0.0) to avoid cracks at the seam.
  float theta = mod(a_texcoord0.y, 1.0);

  float pulseIntensity = 1.0 -(sin(t + a_texcoord0.x * uTileRate + theta * 10.0) + 1.0);
  pulseIntensity *= pulseIntensity;
  pos.xyz += pulseIntensity * a_normal.xyz * waveIntensity * radius;

  gl_Position = projectionMatrix * modelViewMatrix * pos;
  f_fog_coord = gl_Position.z;
  v_position = (modelViewMatrix * pos).xyz;
  // Transform normal and tangent to view space
  vec3 normal = normalize(normalMatrix * a_normal);
  v_normal = normal;
  v_tangent = normalize(normalMatrix * a_tangent.xyz);
  v_binormal = normalize(cross(normal, v_tangent) * a_tangent.w);
  v_light_dir_0 = mat3(u_SceneLight_0_matrix) * vec3(0, 0, 1);
  v_light_dir_1 = mat3(u_SceneLight_1_matrix) * vec3(0, 0, 1);
  v_color = a_color;
  v_texcoord0 = a_texcoord0.xy;
}