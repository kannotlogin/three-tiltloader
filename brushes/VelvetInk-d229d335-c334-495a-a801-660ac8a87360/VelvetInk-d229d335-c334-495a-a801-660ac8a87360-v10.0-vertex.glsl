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

in vec4 a_position;
in vec3 a_normal;
in vec4 a_color;
in vec2 a_texcoord0;
in vec4 a_tangent;

out vec4 v_color;
out vec3 v_normal;
out vec3 v_tangent;
out vec3 v_bitangent;
out vec3 v_position;
out vec2 v_texcoord0;
out vec3 v_light_dir_0;
out vec3 v_light_dir_1;
out float f_fog_coord;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform mat4 u_SceneLight_0_matrix;
uniform mat4 u_SceneLight_1_matrix;

uniform float u_AudioVolume;
uniform vec4 u_BeatFFT;
uniform vec4 u_time;

void main() {
  float audioActive = step(0.001, u_AudioVolume);
  vec3 pos = a_position.xyz;
  
  vec3 audioPos = pos;
  audioPos.x += sin(audioPos.y * 5.0 + u_time.y * 10.0) * u_BeatFFT.w * 0.1;
  audioPos.y += cos(audioPos.z * 5.0 + u_time.y * 10.0) * u_BeatFFT.w * 0.1;
  
  pos = mix(pos, audioPos, audioActive);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  f_fog_coord = gl_Position.z;
  
  vec3 normal = normalize(normalMatrix * a_normal);
  vec3 tangent = normalize(normalMatrix * a_tangent.xyz);
  vec3 bitangent = cross(normal, tangent) * a_tangent.w;
  
  v_normal = normal;
  v_tangent = tangent;
  v_bitangent = bitangent;
  v_position = (modelViewMatrix * vec4(pos, 1.0)).xyz;
  v_light_dir_0 = mat3(u_SceneLight_0_matrix) * vec3(0.0, 0.0, 1.0);
  v_light_dir_1 = mat3(u_SceneLight_1_matrix) * vec3(0.0, 0.0, 1.0);
  
  vec4 audioColor = a_color;
  audioColor.rgb = a_color.rgb * 0.5 + a_color.rgb * u_BeatFFT.w;
  v_color = mix(a_color, audioColor, audioActive);
  
  v_texcoord0 = a_texcoord0;
}