# ConceptCAD natif : ne compile que notre code ; OCCT et wxWidgets arrivent déjà compilés (publications officielles).
cmake_minimum_required(VERSION 3.20)
project(ConceptCADNatif LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(TIERS "${CMAKE_CURRENT_SOURCE_DIR}/.tiers")
set(OCCT "${TIERS}/occt-bin/opencascade-8.0.1-vc14-64")
set(TROIS "${TIERS}/occt-bin/3rdparty-vc14-64")
set(WX "${TIERS}/wx")

add_executable(ConceptCADNatif WIN32 src/main.cpp src/cadre.cpp src/vue3d.cpp src/esquisse2d.cpp src/projet.cpp src/contours.cpp src/rejeu.cpp)
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
