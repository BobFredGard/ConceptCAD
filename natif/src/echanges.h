// Les échanges de fichiers avec les autres logiciels : STEP, STL, OBJ (src/90-30-import.js, src/90-40-export.js).
#pragma once
#include <TopoDS_Shape.hxx>

#include <string>
#include <vector>

#include "projet.h"

// importSrcKey : l'empreinte d'un fichier importé, la même que dans le navigateur
std::string cleImport(const std::string& octets);
std::string base64Coder(const std::string& octets);
std::string base64Decoder(const std::string& texte);

// La forme d'une fonction « import » d'après la source gardée dans le fichier. Une pièce STL est une face maillée, sans solide exact.
// Vide si la source manque ; lève std::runtime_error si elle est illisible. Une même source n'est lue qu'une fois.
TopoDS_Shape formeImportee(const Document& d, const Fonction& f, bool* exacte = nullptr);

// STEP ; schema : "AP214" ou "AP203" ; sansCourbes2D : pour les vieux logiciels. Lèvent std::runtime_error.
void exporterStep(const std::vector<TopoDS_Shape>& formes, const std::wstring& chemin, const std::string& schema, bool sansCourbes2D);
// Le maillage affiché ; les formes doivent être déjà maillées. Binaire pour le STL, comme le navigateur.
void exporterStl(const std::vector<TopoDS_Shape>& formes, const std::wstring& chemin);
void exporterObj(const std::vector<TopoDS_Shape>& formes, const std::wstring& chemin);
