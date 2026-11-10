-- Security advisor (function_search_path_mutable): pin search_path on the append-only guard.
alter function private.forbid_change() set search_path = '';
