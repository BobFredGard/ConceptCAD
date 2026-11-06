# ConceptCAD natif : ne compile que notre code ; OCCT et wxWidgets arrivent déjà compilés (publications officielles).
cmake_minimum_required(VERSION 3.20)
project(ConceptCADNatif LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(TIERS "${CMAKE_CURRENT_SOURCE_DIR}/.tiers")
set(OCCT "${TIERS}/occt-bin/opencascade-8.0.1-vc14-64")
set(TROIS "${TIERS}/occt-bin/3rdparty-vc14-64")
set(WX "${TIERS}/wx")

add_executable(ConceptCADNatif WIN32 src/main.cpp src/cadre.cpp src/vue3d.cpp src/esquisse2d.cpp src/projet.cpp src/enregistrer.cpp src/contours.cpp src/rejeu.cpp src/solveur.cpp src/coter.cpp src/dessin.cpp src/infos_esquisse.cpp src/interface_esquisse.cpp src/environnement.cpp)
target_compile_definitions(ConceptCADNatif PRIVATE UNICODE _UNICODE _CRT_SECURE_NO_WARNINGS NOMINMAX WXUSINGDLL __WXMSW__ wxNO_GL_LIB)
target_compile_options(ConceptCADNatif PRIVATE /utf-8 /MP /EHa /W3)
target_include_directories(ConceptCADNatif PRIVATE "${WX}/lib/vc14x_x64_dll/mswu" "${WX}/include" "${OCCT}/inc" "${TIERS}" "${TROIS}/zlib-1.2.8-vc14-64/include")
target_link_directories(ConceptCADNatif PRIVATE "${WX}/lib/vc14x_x64_dll" "${OCCT}/win64/vc14/lib" "${TROIS}/zlib-1.2.8-vc14-64/lib")
target_link_libraries(ConceptCADNatif PRIVATE
  wxbase33u wxmsw33u_core wxmsw33u_aui wxmsw33u_propgrid
  TKernel TKMath TKG2d TKG3d TKGeomBase TKBRep TKGeomAlgo TKTopAlgo TKPrim TKBO TKShHealing TKMesh
  TKService TKV3d TKOpenGl zlib comctl32 ole32 shell32 user32 gdi32)
# Contrôles Windows modernes (nécessaires à wxWidgets)
target_link_options(ConceptCADNatif PRIVATE "/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'")
set_target_properties(ConceptCADNatif PROPERTIES RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_CURRENT_SOURCE_DIR}/sortie")

# Banc du dessin : les mêmes gestes que le navigateur, l'esquisse comparée après chacun
foreach(BANC BancDessin BancDessinCommunes)
  add_executable(${BANC} src/banc_dessin.cpp src/dessin.cpp src/solveur.cpp src/projet.cpp src/enregistrer.cpp src/infos_esquisse.cpp src/contours.cpp)
  target_compile_definitions(${BANC} PRIVATE UNICODE _UNICODE _CRT_SECURE_NO_WARNINGS NOMINMAX SANS_NOYAU)
  target_compile_options(${BANC} PRIVATE /utf-8 /MP /EHa /W3)
  target_include_directories(${BANC} PRIVATE "${TIERS}" "${TROIS}/zlib-1.2.8-vc14-64/include")
  target_link_directories(${BANC} PRIVATE "${TROIS}/zlib-1.2.8-vc14-64/lib")
  target_link_libraries(${BANC} PRIVATE zlib)
  set_target_properties(${BANC} PROPERTIES RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_CURRENT_SOURCE_DIR}/sortie")
endforeach()
target_compile_definitions(BancDessinCommunes PRIVATE SOLVEUR_MATHS_COMMUNES)

# Banc du solveur d'esquisse : sans fenêtre ni noyau, comparé aux résultats du navigateur
add_executable(BancSolveur src/banc_solveur.cpp src/solveur.cpp src/projet.cpp)
target_compile_definitions(BancSolveur PRIVATE UNICODE _UNICODE _CRT_SECURE_NO_WARNINGS NOMINMAX)
target_compile_options(BancSolveur PRIVATE /utf-8 /MP /EHa /W3)
target_include_directories(BancSolveur PRIVATE "${TIERS}" "${TROIS}/zlib-1.2.8-vc14-64/include")
target_link_directories(BancSolveur PRIVATE "${TROIS}/zlib-1.2.8-vc14-64/lib")
target_link_libraries(BancSolveur PRIVATE zlib)
set_target_properties(BancSolveur PROPERTIES RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_CURRENT_SOURCE_DIR}/sortie")

# Le même banc avec les mêmes sinus, cosinus et arc tangente que la référence (--communes) : il doit tomber juste au dernier chiffre près
add_executable(BancSolveurCommunes src/banc_solveur.cpp src/solveur.cpp src/projet.cpp)
target_compile_definitions(BancSolveurCommunes PRIVATE UNICODE _UNICODE _CRT_SECURE_NO_WARNINGS NOMINMAX SOLVEUR_MATHS_COMMUNES)
target_compile_options(BancSolveurCommunes PRIVATE /utf-8 /MP /EHa /W3)
target_include_directories(BancSolveurCommunes PRIVATE "${TIERS}" "${TROIS}/zlib-1.2.8-vc14-64/include")
target_link_directories(BancSolveurCommunes PRIVATE "${TROIS}/zlib-1.2.8-vc14-64/lib")
target_link_libraries(BancSolveurCommunes PRIVATE zlib)
set_target_properties(BancSolveurCommunes PROPERTIES RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_CURRENT_SOURCE_DIR}/sortie")
