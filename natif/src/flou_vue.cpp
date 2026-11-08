// Le flou sous les panneaux en vitre : voir flou_vue.h.
// Chaque image : la zone est recopiée de l'image en cours (la version lissée de l'anticrénelage), réduite au tiers,
// floutée en deux passes (horizontale puis verticale), puis redessinée à sa place, coins arrondis comme le panneau.
// Tout l'état d'OpenGL touché ici est remis comme OCCT l'avait laissé.
#include "flou_vue.h"

#include <OpenGl_Context.hxx>
#include <OpenGl_Element.hxx>
#include <OpenGl_GlFunctions.hxx>
#include <OpenGl_Group.hxx>
#include <OpenGl_Workspace.hxx>
#include <Prs3d_Presentation.hxx>

#include <algorithm>
#include <cmath>

namespace {
const char* const SOMMET = R"(#version 150
out vec2 vUv;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vUv = c;
  gl_Position = vec4(c * 2.0 - 1.0, 0.0, 1.0);
}
)";
const char* const FLOU = R"(#version 150
uniform sampler2D uTex;
uniform vec2 uPas;
in vec2 vUv;
out vec4 oCouleur;
void main() {
  float w[5] = float[](0.2270, 0.1946, 0.1216, 0.0541, 0.0162);
  vec4 s = texture(uTex, vUv) * w[0];
  for (int i = 1; i < 5; i++) {
    s += texture(uTex, vUv + uPas * float(i)) * w[i];
    s += texture(uTex, vUv - uPas * float(i)) * w[i];
  }
  oCouleur = s;
}
)";
const char* const POSE = R"(#version 150
uniform sampler2D uTex;
uniform vec2 uTaille;
uniform float uRayon;
uniform float uEncoder;
in vec2 vUv;
out vec4 oCouleur;
void main() {
  vec2 p = vUv * uTaille;
  vec2 q = abs(p - uTaille * 0.5) - (uTaille * 0.5 - vec2(uRayon));
  if (length(max(q, 0.0)) - uRayon > 0.0) discard;
  vec4 c = texture(uTex, vUv);
  if (uEncoder > 0.5) c.rgb = pow(max(c.rgb, vec3(0.0)), vec3(1.0 / 2.2));
  oCouleur = c;
}
)";

class ElementFlou : public OpenGl_Element {
 public:
  explicit ElementFlou(std::shared_ptr<ZoneFlou> z) : zone_(std::move(z)) {}
  void Render(const occ::handle<OpenGl_Workspace>& ws) const override;
  void Release(OpenGl_Context* ctx) override {
    if (!ctx || !G.pret) return;
    const OpenGl_GlFunctions* f = ctx->Functions();
    if (!f) return;
    f->glDeleteFramebuffers(3, G.fbo);
    f->glDeleteTextures(3, G.tex);
    f->glDeleteVertexArrays(1, &G.vao);
    for (GLuint p : {G.progFlou, G.progPose})
      if (p) f->glDeleteProgram(p);
    G = Gpu{};
  }

 private:
  struct Gpu {
    bool pret = false, rate = false;
    GLuint fbo[3] = {0, 0, 0}, tex[3] = {0, 0, 0}, vao = 0, progFlou = 0, progPose = 0;
    GLint format = 0, w = 0, h = 0;
  };
  bool preparer(const OpenGl_GlFunctions* f) const;
  std::shared_ptr<ZoneFlou> zone_;
  mutable Gpu G;
};

GLuint programme(const OpenGl_GlFunctions* f, const char* frag) {
  const auto objet = [f](GLenum type, const char* src) {
    const GLuint s = f->glCreateShader(type);
    f->glShaderSource(s, 1, &src, nullptr);
    f->glCompileShader(s);
    GLint ok = 0;
    f->glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
    if (!ok) {
      f->glDeleteShader(s);
      return GLuint(0);
    }
    return s;
  };
  const GLuint v = objet(GL_VERTEX_SHADER, SOMMET), p = objet(GL_FRAGMENT_SHADER, frag);
  GLuint prog = 0;
  if (v && p) {
    prog = f->glCreateProgram();
    f->glAttachShader(prog, v);
    f->glAttachShader(prog, p);
    f->glBindFragDataLocation(prog, 0, "oCouleur");
    f->glLinkProgram(prog);
    GLint ok = 0;
    f->glGetProgramiv(prog, GL_LINK_STATUS, &ok);
    if (!ok) {
      f->glDeleteProgram(prog);
      prog = 0;
    }
  }
  if (v) f->glDeleteShader(v);
  if (p) f->glDeleteShader(p);
  return prog;
}

bool ElementFlou::preparer(const OpenGl_GlFunctions* f) const {
  if (G.pret) return true;
  if (G.rate) return false;
  G.progFlou = programme(f, FLOU);
  G.progPose = programme(f, POSE);
  if (!G.progFlou || !G.progPose || !f->glGenFramebuffers || !f->glBlitFramebuffer || !f->glGenVertexArrays) {
    G.rate = true;  // pas de quoi faire : la vitre reste sans flou
    return false;
  }
  f->glGenFramebuffers(3, G.fbo);
  f->glGenTextures(3, G.tex);
  f->glGenVertexArrays(1, &G.vao);
  G.pret = true;
  return true;
}

void ElementFlou::Render(const occ::handle<OpenGl_Workspace>& ws) const {
  const ZoneFlou z = *zone_;
  if (!z.actif || z.l <= 0 || z.h <= 0) return;
  const occ::handle<OpenGl_Context>& ctx = ws->GetGlContext();
  if (ctx.IsNull() || !ctx->IsGlGreaterEqual(3, 2)) return;
  const OpenGl_GlFunctions* f = ctx->Functions();
  if (!f || !preparer(f)) return;

  // L'état d'OpenGL tel qu'OCCT l'a laissé
  GLint vp[4], sc[4], fboDessin = 0, fboLecture = 0, prog = 0, texActive = 0, tex0 = 0, vao = 0, sampler0 = 0, lecture = 0;
  f->glGetIntegerv(GL_VIEWPORT, vp);
  f->glGetIntegerv(GL_SCISSOR_BOX, sc);
  f->glGetIntegerv(GL_DRAW_FRAMEBUFFER_BINDING, &fboDessin);
  f->glGetIntegerv(GL_READ_FRAMEBUFFER_BINDING, &fboLecture);
  f->glGetIntegerv(GL_READ_BUFFER, &lecture);
  f->glGetIntegerv(GL_CURRENT_PROGRAM, &prog);
  f->glGetIntegerv(GL_ACTIVE_TEXTURE, &texActive);
  f->glActiveTexture(GL_TEXTURE0);
  f->glGetIntegerv(GL_TEXTURE_BINDING_2D, &tex0);
  f->glGetIntegerv(GL_SAMPLER_BINDING, &sampler0);
  f->glGetIntegerv(GL_VERTEX_ARRAY_BINDING, &vao);
  const GLboolean scissor = f->glIsEnabled(GL_SCISSOR_TEST), profondeur = f->glIsEnabled(GL_DEPTH_TEST), melange = f->glIsEnabled(GL_BLEND),
                  faces = f->glIsEnabled(GL_CULL_FACE), stencil = f->glIsEnabled(GL_STENCIL_TEST), srgb = f->glIsEnabled(GL_FRAMEBUFFER_SRGB);
  GLboolean masque[4];
  f->glGetBooleanv(GL_COLOR_WRITEMASK, masque);

  // La zone, en pixels de l'image (origine en bas à gauche)
  const int W = vp[2], H = vp[3];
  const int x0 = std::max(0, static_cast<int>(std::lround(vp[0] + z.x * W))), x1 = std::min(vp[0] + W, static_cast<int>(std::lround(vp[0] + (z.x + z.l) * W)));
  const int yh = static_cast<int>(std::lround(vp[1] + (1 - z.y - z.h) * H)), yb = static_cast<int>(std::lround(vp[1] + (1 - z.y) * H));
  const int y0 = std::max(0, yh), y1 = std::min(vp[1] + H, yb);
  const int w = x1 - x0, h = y1 - y0;
  if (w < 8 || h < 8) return;

  // Le format de l'image en cours : la recopie doit le garder (exigé quand l'image est anticrénelée)
  GLint format = GL_RGBA8;
  if (fboDessin != 0) {
    GLint type = 0, nom = 0;
    f->glGetFramebufferAttachmentParameteriv(GL_DRAW_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE, &type);
    f->glGetFramebufferAttachmentParameteriv(GL_DRAW_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_FRAMEBUFFER_ATTACHMENT_OBJECT_NAME, &nom);
    if (type == GL_RENDERBUFFER) {
      GLint avant = 0;
      f->glGetIntegerv(GL_RENDERBUFFER_BINDING, &avant);
      f->glBindRenderbuffer(GL_RENDERBUFFER, nom);
      f->glGetRenderbufferParameteriv(GL_RENDERBUFFER, GL_RENDERBUFFER_INTERNAL_FORMAT, &format);
      f->glBindRenderbuffer(GL_RENDERBUFFER, avant);
    } else if (type == GL_TEXTURE) {
      GLint ms = 0, avant = 0;
      f->glGetFramebufferAttachmentParameteriv(GL_DRAW_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL, &ms);
      GLint echantillons = 0;
      f->glGetIntegerv(GL_SAMPLES, &echantillons);
      const GLenum cible = echantillons > 0 ? GL_TEXTURE_2D_MULTISAMPLE : GL_TEXTURE_2D;
      f->glGetIntegerv(echantillons > 0 ? GL_TEXTURE_BINDING_2D_MULTISAMPLE : GL_TEXTURE_BINDING_2D, &avant);
      f->glBindTexture(cible, nom);
      f->glGetTexLevelParameteriv(cible, 0, GL_TEXTURE_INTERNAL_FORMAT, &format);
      f->glBindTexture(cible, avant);
    }
  }
  const int w4 = std::max(2, w / 3), h4 = std::max(2, h / 3);  // au tiers : un flou léger
  if (format != G.format || w != G.w || h != G.h) {
    G.format = format, G.w = w, G.h = h;
    const int tailles[3][2] = {{w, h}, {w4, h4}, {w4, h4}};
    for (int i = 0; i < 3; i++) {
      f->glBindTexture(GL_TEXTURE_2D, G.tex[i]);
      f->glTexImage2D(GL_TEXTURE_2D, 0, format, tailles[i][0], tailles[i][1], 0, GL_RGBA, GL_UNSIGNED_BYTE, nullptr);
      f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
      f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
      f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
      f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
      f->glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAX_LEVEL, 0);
      f->glBindFramebuffer(GL_FRAMEBUFFER, G.fbo[i]);
      f->glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, G.tex[i], 0);
    }
  }
  f->glDisable(GL_SCISSOR_TEST);
  f->glDisable(GL_DEPTH_TEST);
  f->glDisable(GL_BLEND);
  f->glDisable(GL_CULL_FACE);
  f->glDisable(GL_STENCIL_TEST);
  f->glColorMask(GL_TRUE, GL_TRUE, GL_TRUE, GL_TRUE);
  // 1. La zone, lissée de son anticrénelage
  f->glBindFramebuffer(GL_READ_FRAMEBUFFER, fboDessin);
  if (fboDessin == 0) f->glReadBuffer(GL_BACK);
  f->glBindFramebuffer(GL_DRAW_FRAMEBUFFER, G.fbo[0]);
  f->glBlitFramebuffer(x0, y0, x1, y1, 0, 0, w, h, GL_COLOR_BUFFER_BIT, GL_NEAREST);
  // 2. Réduite au tiers
  f->glBindFramebuffer(GL_READ_FRAMEBUFFER, G.fbo[0]);
  f->glBindFramebuffer(GL_DRAW_FRAMEBUFFER, G.fbo[1]);
  f->glBlitFramebuffer(0, 0, w, h, 0, 0, w4, h4, GL_COLOR_BUFFER_BIT, GL_LINEAR);
  // 3. Floutée : en largeur vers la 3e image, en hauteur retour vers la 2e
  f->glBindVertexArray(G.vao);
  f->glBindSampler(0, 0);
  f->glUseProgram(G.progFlou);
  f->glUniform1i(f->glGetUniformLocation(G.progFlou, "uTex"), 0);
  const GLint pas = f->glGetUniformLocation(G.progFlou, "uPas");
  f->glViewport(0, 0, w4, h4);
  f->glBindFramebuffer(GL_DRAW_FRAMEBUFFER, G.fbo[2]);
  f->glBindTexture(GL_TEXTURE_2D, G.tex[1]);
  f->glUniform2f(pas, 1.0f / w4, 0.0f);
  f->glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
  f->glBindFramebuffer(GL_DRAW_FRAMEBUFFER, G.fbo[1]);
  f->glBindTexture(GL_TEXTURE_2D, G.tex[2]);
  f->glUniform2f(pas, 0.0f, 1.0f / h4);
  f->glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
  // 4. Remise en place, coins arrondis
  bool encoder = false;
  if (fboDessin != 0 && !srgb && (format == GL_SRGB8_ALPHA8 || format == GL_SRGB8)) encoder = true;
  f->glBindFramebuffer(GL_DRAW_FRAMEBUFFER, fboDessin);
  f->glViewport(x0, y0, w, h);
  f->glUseProgram(G.progPose);
  f->glUniform1i(f->glGetUniformLocation(G.progPose, "uTex"), 0);
  f->glUniform2f(f->glGetUniformLocation(G.progPose, "uTaille"), static_cast<float>(w), static_cast<float>(h));
  f->glUniform1f(f->glGetUniformLocation(G.progPose, "uRayon"), static_cast<float>(z.rayon * H));
  f->glUniform1f(f->glGetUniformLocation(G.progPose, "uEncoder"), encoder ? 1.0f : 0.0f);
  f->glBindTexture(GL_TEXTURE_2D, G.tex[1]);
  f->glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);

  // Tout revient comme avant
  f->glUseProgram(prog);
  f->glBindVertexArray(vao);
  f->glBindTexture(GL_TEXTURE_2D, tex0);
  f->glBindSampler(0, sampler0);
  f->glActiveTexture(texActive);
  f->glBindFramebuffer(GL_DRAW_FRAMEBUFFER, fboDessin);
  f->glBindFramebuffer(GL_READ_FRAMEBUFFER, fboLecture);
  if (fboLecture == 0) f->glReadBuffer(lecture);
  f->glViewport(vp[0], vp[1], vp[2], vp[3]);
  f->glScissor(sc[0], sc[1], sc[2], sc[3]);
  const auto remettre = [f](GLenum c, GLboolean v) { v ? f->glEnable(c) : f->glDisable(c); };
  remettre(GL_SCISSOR_TEST, scissor);
  remettre(GL_DEPTH_TEST, profondeur);
  remettre(GL_BLEND, melange);
  remettre(GL_CULL_FACE, faces);
  remettre(GL_STENCIL_TEST, stencil);
  f->glColorMask(masque[0], masque[1], masque[2], masque[3]);
}
}  // namespace

FlouVue::FlouVue() : zone(std::make_shared<ZoneFlou>()) {}

void FlouVue::Compute(const occ::handle<PrsMgr_PresentationManager>&, const occ::handle<Prs3d_Presentation>& prs, const int) {
  prs->Clear();
  prs->SetInfiniteState(true);  // jamais écarté : il n'a pas de place dans la scène
  const occ::handle<Graphic3d_Group> g = prs->NewGroup();
  if (OpenGl_Group* og = dynamic_cast<OpenGl_Group*>(g.get())) og->AddElement(new ElementFlou(zone));
}
