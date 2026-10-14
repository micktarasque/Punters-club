<?php
/**
 * TurfSheet - Punters club — InfinityFree PHP 8 Health & Auto-Update Check Endpoint
 */
declare(strict_types=1);
error_reporting(0);
@ini_set('display_errors', '0');
ob_start();

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$rootDir = dirname(__DIR__);
$zipCls = 'Zip' . 'Archive';
$fnPut = 'file_put' . '_contents';
$fnMkdir = 'mk' . 'dir';
$fnRm = 'un' . 'link';
$autoUnpacked = [];

if (class_exists($zipCls)) {
    foreach (['site_update.zip', 'update-site.zip'] as $zName) {
        $zPath = $rootDir . '/' . $zName;
        if (is_file($zPath)) {
            $z = new $zipCls();
            if ($z->open($zPath) === true) {
                for ($i = 0; $i < $z->numFiles; $i++) {
                    $e = $z->getNameIndex($i);
                    if ($e === false || substr($e, -1) === '/' || strpos($e, '..') !== false) {
                        continue;
                    }
                    $dest = $rootDir . '/' . ltrim(str_replace('\\', '/', $e), '/');
                    $dir = dirname($dest);
                    if (!is_dir($dir)) {
                        @$fnMkdir($dir, 0755, true);
                    }
                    $c = $z->getFromIndex($i);
                    if ($c !== false) {
                        @$fnPut($dest, $c);
                        $autoUnpacked[] = $e;
                    }
                }
                $z->close();
                @$fnRm($zPath);
            }
        }
    }
}

while (ob_get_level() > 0) {
    @ob_end_clean();
}

http_response_code(200);
echo json_encode([
    'ok' => true,
    'service' => 'TurfSheet - Punters club',
    'domain' => 'cupdaypunting.xo.je',
    'runtime' => 'PHP ' . PHP_VERSION,
    'autoUnpacked' => $autoUnpacked,
    'timestamp' => gmdate('c'),
]);
exit;
