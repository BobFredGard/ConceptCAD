# ConceptCAD natif : ne compile que notre code ; OCCT arrive déjà compilé (publication officielle V8.0.1).
cmake_minimum_required(VERSION 3.20)
project(ConceptCADNatif LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(TIERS "${CMAKE_CURRENT_SOURCE_DIR}/.tiers")
set(OCCT "${TIERS}/occt-bin/opencascade-8.0.1-vc14-64")
set(TROIS "${TIERS}/occt-bin/3rdparty-vc14-64")

add_executable(ConceptCADNatif WIN32 src/main.cpp src/projet.cpp src/contours.cpp src/rejeu.cpp)
target_compile_definitions(ConceptCADNatif PRIVATE UNICODE _UNICODE _CRT_SECURE_NO_WARNINGS)
target_compile_options(ConceptCADNatif PRIVATE /utf-8 /MP /EHa /W3)
target_include_directories(ConceptCADNatif PRIVATE "${OCCT}/inc" "${TIERS}" "${TROIS}/zlib-1.2.8-vc14-64/include")
target_link_directories(ConceptCADNatif PRIVATE "${OCCT}/win64/vc14/lib" "${TROIS}/zlib-1.2.8-vc14-64/lib")
target_link_libraries(ConceptCADNatif PRIVATE
  TKernel TKMath TKG2d TKG3d TKGeomBase TKBRep TKGeomAlgo TKTopAlgo TKPrim TKBO TKShHealing TKMesh
  TKService TKV3d TKOpenGl zlib comctl32 ole32 shell32 user32 gdi32)
set_target_properties(ConceptCADNatif PROPERTIES RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_CURRENT_SOURCE_DIR}/sortie")
