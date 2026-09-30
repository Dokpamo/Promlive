#pragma once
#include "NativeModules.h"
#include <ShlObj.h>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <mutex>
#include <stdexcept>

namespace winrt::Microsoft::ReactNative {
REACT_MODULE(PromliveScreenMemory);
struct PromliveScreenMemory {
  std::mutex mutex;
  static std::filesystem::path File(const wchar_t *name) {
    PWSTR localPath = nullptr;
    if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &localPath))) throw std::runtime_error("Cannot locate screen memory");
    std::filesystem::path directory(localPath);
    CoTaskMemFree(localPath);
    directory /= L"Promlive";
    std::filesystem::create_directories(directory);
    return directory / name;
  }
  static std::string Load(bool backup) {
    const auto path = File(backup ? L"screen-memory.backup.json" : L"screen-memory.json");
    if (!std::filesystem::exists(path)) return {};
    std::ifstream stream(path, std::ios::binary);
    if (!stream) throw std::runtime_error("Cannot read screen memory");
    return {std::istreambuf_iterator<char>(stream), std::istreambuf_iterator<char>()};
  }
  REACT_SYNC_METHOD(ReadSync, L"readSync");
  std::string ReadSync(bool backup) noexcept {
    try {std::scoped_lock guard(mutex); return Load(backup);}
    catch (...) {return {};}
  }
  REACT_METHOD(Read, L"read");
  void Read(ReactPromise<std::string> promise) noexcept {
    try {std::scoped_lock guard(mutex); promise.Resolve(Load(false));}
    catch (...) {promise.Reject("Cannot read screen memory");}
  }
  REACT_METHOD(Write, L"write");
  void Write(std::string value, ReactPromise<void> promise) noexcept {
    try {
      std::scoped_lock guard(mutex);
      const auto path = File(L"screen-memory.json");
      const auto temporary = File(L"screen-memory.tmp");
      const auto backup = File(L"screen-memory.backup.json");
      {
        std::ofstream stream(temporary, std::ios::binary | std::ios::trunc);
        stream.write(value.data(), static_cast<std::streamsize>(value.size()));
        stream.flush();
        if (!stream) throw std::runtime_error("Cannot save screen memory");
      }
      if (std::filesystem::exists(path) && !CopyFileW(path.c_str(), backup.c_str(), FALSE)) throw std::runtime_error("Cannot back up screen memory");
      if (!MoveFileExW(temporary.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) throw std::runtime_error("Cannot replace screen memory");
      promise.Resolve();
    } catch (...) {promise.Reject("Cannot save screen memory");}
  }
};
}
