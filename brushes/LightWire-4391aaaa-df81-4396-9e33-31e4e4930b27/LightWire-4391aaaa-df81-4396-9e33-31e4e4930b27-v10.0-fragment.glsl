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
uniform float u_Shininess;   
uniform vec3 u_SpecColor;
uniform vec4 u_time;

uniform float u_AudioVolume;
uniform vec4 u_BeatFFT;

in vec4 v_color;
in vec3 v_normal;
in vec3 v_position;
in vec3 v_light_dir_0;
in vec3 v_light_dir_1;
in vec2 v_texcoord0;
in float f_fog_coord;

// Copyright 2020 The Tilt Brush Authors
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

vec3 computeLighting(vec3 diffuseColor, vec3 specularColor, float shininess) {
  vec3 normal = normalize(v_normal);
  if (!gl_FrontFacing) {
    normal *= -1.0;
  }
  vec3 lightDir0 = normalize(v_light_dir_0);
  vec3 lightDir1 = normalize(v_light_dir_1);
  vec3 eyeDir = -normalize(v_position);

  vec3 lightOut0 = SurfaceShaderSpecularGloss(normal, lightDir0, eyeDir, u_SceneLight_0_color.rgb,
      diffuseColor, specularColor, shininess);
  vec3 lightOut1 = ShShaderWithSpec(normal, lightDir1, u_SceneLight_1_color.rgb, diffuseColor, u_SpecColor);
  vec3 ambientOut = diffuseColor * u_ambient_light_color.rgb;

  return (lightOut0 + lightOut1 + ambientOut);
}

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
  
  float envelope = sin ( mod ( v_texcoord0.x*2., 1.) * 3.14159); 
  float lights = envelope < .1 ? 1. : 0.; 
  float border = abs(envelope - .1) < .01 ? 0. : 1.;

  vec3 specularColor = vec3(.3,.3,.3) - lights * vec3(.15,.15,.15);
  float smoothness = .3 - lights * .3;

  float beatAccumX = u_time.y * 3.0 + u_BeatFFT.x;
  float t = mix(u_time.w, beatAccumX * 10.0, audioActive);

  vec4 color = v_color;
  if (lights > 0.) {
    float colorindex = floor(mod(v_texcoord0.x*2. + 0.5, 3.));
    if (colorindex == 0.) color.rgb = color.rgb * vec3(.2,.2,1.);
    else if (colorindex == 1.) color.rgb = color.rgb * vec3(1.,.2,.2);
    else color.rgb = color.rgb * vec3(.2,1.,.2);
        
    float lightindex =  mod(v_texcoord0.x*2. + .5,7.); 
    float timeindex = mod(t, 7.);
    float delta = abs(lightindex - timeindex);
    float on = 1. - clamp(delta*1.5, 0.0, 1.0);
    color = bloomColor(color * on, .7);
  }

  vec3 diffuseColor = (1.- lights) *  color.rgb * .2;
  diffuseColor *= border;
  specularColor *= border;
  
  fragColor.rgb = computeLighting(diffuseColor, specularColor, smoothness);
  fragColor.a = 1.0;

  vec3 emissionColor = color.rgb;
  vec3 audioEmission = emissionColor * 0.25 + emissionColor * u_BeatFFT.x * 0.75;
  emissionColor = mix(emissionColor, audioEmission, audioActive);

  fragColor.rgb += lights * emissionColor;
  fragColor.rgb = ApplyFog(fragColor.rgb, f_fog_coord);
}