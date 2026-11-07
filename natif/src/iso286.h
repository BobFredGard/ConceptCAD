// Les tolérances ISO 286 (src/05-iso286.js)
#pragma once
#include <optional>
#include <string>

struct EcartsIso {
  double lo = 0, hi = 0;  // en mm
};
std::optional<EcartsIso> ecartsIso286(const std::string& classe, double nominal);
