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
in vec4 a_texcoord0;
in vec4 a_texcoord1;
in vec4 a_tangent;

out vec4 v_color;
out vec3 v_normal;
out vec3 v_tangent;
out vec3 v_bitangent;
out vec3 v_position;
out vec2 v_texcoord0;
out vec4 v_texcoord1;

uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

uniform vec4 u_time;
uniform float u_ScrollRate;
uniform vec3 u_ScrollDistance;
uniform float u_ScrollJitterIntensity;
uniform float u_ScrollJitterFrequency;

uniform float u_AudioVolume;
uniform vec4 u_BeatFFT;

vec4 _Time;

const float kRecipSquareRootOfTwo = 0.70710678;

vec3 recreateCorner(vec3 center, float corner, float rotation, float size) {
  float c = cos(rotation);
  float s = sin(rotation);

  vec3 up = vec3(s, c, 0.0);
  vec3 right = vec3(c, -s, 0.0);

  float fUp = float(corner == 0.0 || corner == 1.0) * 2.0 - 1.0;
  float fRight = float(corner == 0.0 || corner == 2.0) * 2.0 - 1.0;

  center = (modelViewMatrix * vec4(center, 1.0)).xyz;
  center += fRight * right * size;
  center += fUp * up * size;
  return (inverse(modelViewMatrix) * vec4(center, 1.0)).xyz;
}

vec4 PositionParticle(float vertexId, vec4 vertexPos, vec3 center, float rotation) {
  float corner = mod(vertexId, 4.0);
  float size = length(vertexPos.xyz - center) * kRecipSquareRootOfTwo;

  float scale = modelMatrix[1][1];
  vec3 newCorner = recreateCorner(center, corner, rotation, size * scale);

  return vec4(newCorner.x, newCorner.y, newCorner.z, 1.0);
}

vec4 GetParticlePositionLS() {
  return PositionParticle(float(gl_VertexID), a_position, a_normal, a_texcoord0.z);
}

void main() {
  vec4 pos = GetParticlePositionLS();
  _Time = u_time;
  
  vec3 normal = normalize(normalMatrix * a_normal);
  vec3 tangent = normalize(normalMatrix * a_tangent.xyz);
  vec3 bitangent = cross(normal, tangent) * a_tangent.w;
  
  v_normal = normal;
  v_tangent = tangent;
  v_bitangent = bitangent;
  v_texcoord0 = a_texcoord0.xy;
  v_texcoord1 = a_texcoord1;

  float audioActive = step(0.001, u_AudioVolume);
  vec4 baseColor = a_color;
  vec4 audioColor = a_color;
  audioColor.rgb = a_color.rgb * 0.5 + a_color.rgb * u_BeatFFT.w;
  v_color = mix(baseColor, audioColor, audioActive);

  float scrollAmount = _Time.y;
  float t = mod(scrollAmount * u_ScrollRate + a_color.a, 1.0);

  vec4 dispVec = (t - 0.5) * vec4(u_ScrollDistance.x, u_ScrollDistance.y, u_ScrollDistance.z, 0.0);
  dispVec.x += sin(t * u_ScrollJitterFrequency + _Time.y) * u_ScrollJitterIntensity;
  dispVec.z += cos(t * u_ScrollJitterFrequency * 0.5 + _Time.y) * u_ScrollJitterIntensity;

  vec3 worldPos = (modelMatrix * pos).xyz;
  worldPos.xyz += dispVec.xyz;

  vec3 audioWorldPos = worldPos;
  audioWorldPos.x += sin(audioWorldPos.y * 5.0 + _Time.y * 10.0) * u_BeatFFT.w * 0.2;
  audioWorldPos.y += cos(audioWorldPos.z * 5.0 + _Time.y * 10.0) * u_BeatFFT.w * 0.2;
  worldPos = mix(worldPos, audioWorldPos, audioActive);

  v_color.a = pow(1.0 - abs(2.0*(t - 0.5)), 3.0);

  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  v_position = (modelViewMatrix * pos).xyz;
}